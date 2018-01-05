'use strict';

// MODULES
// ----------------------------------------------------------------------------
var path = require('path');
var fs = require('fs');
var kss = require('kss');
var glob = require('glob');
var gulp = require('gulp');
var data = require('gulp-data');
var newer = require('gulp-newer');
var markdown = require('gulp-markdown');
var dox = require('gulp-dox');
var twig = require('gulp-twig-pipe');
var del = require('del');
var ENV = require('../tools/env');

var SRC = path.join(ENV.doc['src-dir'], '**', '*.md');
var SRC_JS = path.join(ENV.js['src-dir'], '**', '*.js');

var DEST = path.resolve(ENV.doc['dest-dir']);
var DEST_URL = DEST.replace(path.resolve(ENV.connect.baseDir), '').replace(path.sep, '/');


// UTILS
// ----------------------------------------------------------------------------
function extractData(file) {
  var parsed = path.parse(file.path);

  // Basic configuration for MarkDown files
  var src   = ENV.doc['src-dir'];
  var gPath = SRC;
  var rURL  = DEST_URL;
  var out   = {
    filename: parsed.name
  };

  // Extra configuration for JavaScript files
  if (parsed.ext === '.json') {
    src = ENV.js['src-dir'];
    gPath = SRC_JS;
    rURL += '/js';
    out.data = JSON.parse(file.contents);
  }

  // Set up final URL for the document
  out.url = file.path.replace(src, rURL).replace(parsed.ext, '.html');

  // Special case js/index.md which is the Javascript doc homepage
  if (parsed.name === 'index' && parsed.dir.slice(-3) === '/js') {
    src = ENV.js['src-dir'];
    gPath = SRC_JS;
    rURL += '/js';
  }

  out.toc = [];

  // Index related content
  glob.sync(gPath)
    .reduce(function (a, f) {
      var u = f
        .replace(src, rURL)
        .replace(path.parse(f).ext, '.html');

      // Ignore JS API homepage (it has its own entry within templates)
      if (u === rURL + '/js/index.html') { return a; }

      a.push(u);

      return a;
    }, [])
    .sort(function (a, b) {
      return a.localeCompare(b);
    }).forEach(function (currentValue, index) {
      var p = path.parse(currentValue);

      var dir = p.dir.replace(rURL, '').replace(/^\//, '');

      var branch = out.toc;

      var folder = null;

      var name = p.name;

      if (dir !== '') {
        var dirs = dir.split('/')
        dirs.forEach(function (part){
          var found = branch.findIndex(function (e) {return e.name === part});
          if (found < 0) {
            folder = {
              name: part,
              children:[]
            };
            branch.push(folder);
          }
          else {
            folder = branch[found];
          }

          branch = folder.children;
        });

      }

      if (name !== 'index') {
        branch.push({
          name: name,
          url: currentValue
        });
      }
      else if (folder !== null) {
        folder.url = currentValue
      }
    });

  return out;
}


// HBS HELPERS
// ----------------------------------------------------------------------------
var folderPath = '../tools/doc/helpers';
fs.readdirSync(path.resolve(path.relative(process.cwd(), __dirname), folderPath)).forEach(function(file) {
  require(path.join(folderPath, file))(twig.twig);
});

// MARKED CUSTOM RENDERER
// ----------------------------------------------------------------------------
var renderer = new markdown.marked.Renderer();

// Link to markdown files are transformed into link to HTML files
// This allow to use both the gitlab markdown linking and the HTML
// transformation for exporting the doc.
renderer.link = function (href, title, text) {
  var url = [];
  url.push('<a href="');
  url.push(href.replace(/\.md$/, '.html'));
  url.push('"');

  if (title) {
    url.push(' title="');
    url.push(title);
    url.push('"');
  }

  url.push('>');
  url.push(text);
  url.push('</a>');

  return url.join('');
};


// TASK DEFINITION
// ----------------------------------------------------------------------------

// $ gulp doc:js
// ----------------------------------------------------------------------------
// Génère la documentation des fichiers javascripts
gulp.task('doc:js', function () {
  return gulp.src(SRC_JS)
    .pipe(newer(path.join(DEST, 'js')))
    .pipe(dox())
    .pipe(data(extractData))
    .pipe(twig(path.relative(process.cwd(), path.join(__dirname, '../tools/doc/jsdoc.html.twig')), { dataSource: 'data' }))
    .pipe(gulp.dest(path.join(DEST, 'js')));
});
gulp.task('doc:js').description = 'Compile Javascript documentation.';

// $ gulp doc:static
// ----------------------------------------------------------------------------
// Génère toute la doc statique du projet
gulp.task('doc:static', function () {
  return gulp.src(SRC)
    .pipe(newer(DEST))
    .pipe(markdown({
      renderer: renderer
    }))
    .pipe(data(extractData))
    .pipe(twig(path.relative(process.cwd(), path.join(__dirname, '../tools/doc/staticdoc.html.twig')), { dataSource: 'data' }))
    .pipe(gulp.dest(DEST));
});
gulp.task('doc:static').description = 'Compile the static documentation.'

// $ gulp doc:kss
// ----------------------------------------------------------------------------
// Génère le styleguide du projet via KSS
gulp.task('doc:kss', function (cb) {
  var CONF = require(path.relative(__dirname, path.join(process.cwd(), 'kss.js')));
  // CONF.verbose = true; // TODO: verbose should be an option

  // clean styleguide directory
  del(path.join(CONF.destination, '**/*')).then(() => {
    // build kss styleguide
    kss(CONF).then(() => {
      cb(null);
    });
  });
});
gulp.task('doc:kss').description = 'Compile the styleguide, using KSS.';

// $ gulp doc
// ----------------------------------------------------------------------------
// Génère toute la doc du projet
gulp.task('doc', function (cb) {
  // Si on optimize le projet, on n'inclus pas la documentation.
  if (!ENV.all.doc && ENV.all.optimize) {
    cb(null);
    return;
  }

  gulp.series('doc:static', gulp.parallel('doc:kss', 'doc:js'), cb);
});
gulp.task('doc').description = 'Compile all documentations of the project.';
