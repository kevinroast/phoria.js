/**
 * Phoria root namespace.
 *
 * @namespace Phoria
 */

define('phoria-namespace', [], function() {
   var Phoria = {};

   // Global static Phoria constants
   Phoria.RADIANS = Math.PI/180.0;
   Phoria.TWOPI = Math.PI*2;
   Phoria.ONEOPI = 1.0/Math.PI;
   Phoria.PIO2 = Math.PI/2;
   Phoria.PIO4 = Math.PI/4;
   Phoria.EPSILON = 0.000001;
   Phoria.CLIP_ARRAY_TYPE = (typeof Uint32Array !== 'undefined') ? Uint32Array : Array;

   return Phoria;

});