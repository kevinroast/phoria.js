define(['phoria-namespace', 'phoria-util', 'entities/phoria-base-entity', 'phoria-gl-matrix'], 
  function(Phoria, Util, BaseEntity, PhoriaGlMatrix) {

  Phoria.Util = Util;
  Phoria.BaseEntity = BaseEntity;
  
  var vec2     = PhoriaGlMatrix.vec2,
      vec3     = PhoriaGlMatrix.vec3,
      vec4     = PhoriaGlMatrix.vec4,
      mat2     = PhoriaGlMatrix.mat2,
      mat3     = PhoriaGlMatrix.mat3,
      mat4     = PhoriaGlMatrix.mat4,
      mat2d    = PhoriaGlMatrix.mat2d,
      quat     = PhoriaGlMatrix.quat,
      glMatrix = PhoriaGlMatrix.glMatrix;

  (function() {
     "use strict";
     
     Phoria.PositionalAspect = {};
     
     /**
      * The PositionalAspect has defines a prototype for objects that may not be rendered directly (i.e. do not need
      * to have a visible entity) but do represent a position in the scene.
      * 
      * Augment a prototype with this aspect to provide an easy way to keep track of a it's position in the scene after
      * matrix transformations have occured. Examine worldposition at runtime (ensure not null) to get current position.
      * 
      * Set the initial position on object construction if the entity is not positioned at the origin by default.
      */
     Phoria.PositionalAspect.prototype =
     {
        // {xyz} the position of the entity
        position: null,
        // {vec4} the transformed world position of the entity
        worldposition: null,
        
        updatePosition: function updatePosition(matLocal)
        {
           // update worldposition position of emitter by local transformation -> world
           var vec = vec4.fromXYZ(this.position, 1);
           vec4.transformMat4(vec, vec, matLocal);
           this.worldposition = vec;
        }
     };
  })();

  return Phoria.PositionalAspect;
});