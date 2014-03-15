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

     /**
      * BaseLight is the base that the Light classes extend from. Provides RGB color and light intensity properties.
      */
     Phoria.BaseLight = function()
     {
        Phoria.BaseLight.superclass.constructor.call(this);
        
        this.color = [1.0, 1.0, 1.0];
        this.intensity = 1.0;
        
        return this;
     };
     
     Phoria.Util.extend(Phoria.BaseLight, Phoria.BaseEntity, {
        // [r,g,b] - note! light colour component levels are specified from 0.0 - 1.0
        color: null,
        
        // {Number} light intensity typically between 0-1
        intensity: 0.0
     });
  })();

  return Phoria.BaseLight;

});