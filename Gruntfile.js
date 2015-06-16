module.exports = function(grunt) {
  
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    requirejs: {
      build: {
        options: {
          almond: true,
          mainConfigFile: 'amd/phoria.js',
          optimize: 'none',
          baseUrl: 'amd',
          out: 'scripts/phoria-amd.js',
          name: 'phoria',
          //insertRequire: ['phoria'],
          include: [ 'almond' ]
        }
      },
      buildStandalone: {
        options: {
          almond: true,
          mainConfigFile: 'amd/phoria.js',
          optimize: 'none',
          baseUrl: 'amd',
          out: 'scripts/phoria-standalone.js',
          name: 'phoria',
          wrap: {
            startFile: 'amd/require-frags/start.js',
            endFile: 'amd/require-frags/end.js',
          },
          include: [ 'almond' ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.registerTask('default', ['requirejs:build', 'requirejs:buildStandalone']);
}
