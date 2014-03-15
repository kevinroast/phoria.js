define([
  'phoria-namespace', 'phoria-util',
  'renderers/phoria-renderer',
  'renderers/phoria-canvas-renderer',
  'renderers/phoria-software-renderer',
  'entities/phoria-base-entity',
  'entities/phoria-entity',
  'entities/phoria-emitter-entity',
  'entities/phoria-base-light',
  'entities/phoria-distant-light',
  'entities/phoria-point-light',
  'entities/phoria-physics-entity',
  'entities/phoria-positional-aspect',
  'phoria-view',
  'phoria-scene'
  ], function(
    Phoria, Util, 
    Renderer, CanvasRenderer, SoftwareRenderer,
    BaseEntity, Entity, EmitterEntity,
    BaseLight, DistantLight, PointLight,
    PhysicsEntity, PositionalAspect,
    View, Scene
    ) {

  Phoria.Util = Util;
  Phoria.Renderer = Renderer;
  Phoria.CanvasRenderer = CanvasRenderer;
  Phoria.SoftwareRenderer = SoftwareRenderer;
  Phoria.BaseEntity = BaseEntity;
  Phoria.Entity = Entity;
  Phoria.EmitterEntity = EmitterEntity;
  Phoria.BaseLight = BaseLight;
  Phoria.DistantLight = DistantLight;
  Phoria.PointLight = PointLight;
  Phoria.PhysicsEntity = PhysicsEntity;
  Phoria.PositionalAspect = PositionalAspect;
  Phoria.View = View;
  Phoria.Scene = Scene;

  window.Phoria = Phoria;
  return Phoria;
});
