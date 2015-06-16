/**
 * @fileoverview phoria - Scene renderers. Canvas renderer and prototype Software renderer.
 * @author Kevin Roast
 * @date 14th April 2013
 */

define(['phoria-namespace', 'phoria-util', 'renderers/phoria-renderer', 'phoria-gl-matrix'], 
  function(Phoria, Util, Renderer, PhoriaGlMatrix) {

  Phoria.Util = Util;
  Phoria.Renderer = Renderer;

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
      * CanvasRenderer will output the scene onto the supplied canvas context using the 2D drawing context. Standard canvas
      * 2D operations such as drawing arcs, lines and filled shapes will be used to render the 3D entities. A lot of the rendering
      * techniques are based on the work done in my first JavaScript 3D library 'K3D' see bit.ly/canvask3d
      */
     Phoria.CanvasRenderer = function(canvas)
     {
        Phoria.CanvasRenderer.superclass.constructor.call(this);

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        return this;
     };
     
     Phoria.Util.extend(Phoria.CanvasRenderer, Phoria.Renderer, {
        // {Object} canvas to use as the output context
        canvas: null,
        
        ctx: null,
        
        /**
         * Render the given scene to the canvas context
         * 
         * @param {Phoria.Scene} scene   The scene to render - processed by scene.modelView()
         * @param {function} fnClear     Optional canvas clearing strategy function - otherwise clearRect() is used
         */
        render: function render(scene, fnClear)
        {
           this.sortObjects(scene);
           
           // clear the canvas before rendering begins - optional clearing function can be supplied
           var ctx = this.ctx;
           if (!fnClear)
           {
              ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
           }
           else
           {
              fnClear.call(this, ctx);
           }
           
           // scene performs all local, world and projection calculations and flattens the rendering list ready for rendering.
           for (var n=0, obj; n<scene.renderlist.length; n++)
           {
              obj = scene.renderlist[n];

              ctx.save();
              if (obj.style.compositeOperation)
              {
                 ctx.globalCompositeOperation = obj.style.compositeOperation;
              }
              switch (obj.style.drawmode)
              {
                 case "solid":
                 {
                    // ensure line width is set if appropriate fillmode is being used
                    if (obj.style.fillmode === "fillstroke" || obj.style.fillmode === "hiddenline") ctx.lineWidth = 1.0;
                    
                    // render the pre-sorted polygons
                    for (var i=0; i<obj.polygons.length; i++)
                    {
                       this.renderPolygon(ctx, obj, scene, obj.polygons[i]);
                    }
                    break;
                 }
                 
                 case "wireframe":
                 {
                    ctx.lineWidth = obj.style.linewidth;
                    ctx.globalAlpha = obj.style.opacity;
                    if (obj.style.shademode === "plain")
                    {
                       ctx.strokeStyle = "rgb(" + obj.style.color[0] + "," + obj.style.color[1] + "," + obj.style.color[2] + ")";
                       ctx.beginPath();
                       for (var i=0; i<obj.edges.length; i++)
                       {
                          this.renderEdge(ctx, obj, scene, obj.edges[i]);
                       }
                       ctx.closePath();
                       ctx.stroke();
                    }
                    else
                    {
                       for (var i=0; i<obj.edges.length; i++)
                       {
                          this.renderEdge(ctx, obj, scene, obj.edges[i]);
                       }
                    }
                    break;
                 }
                 
                 case "point":
                 {
                    // assert to ensure that the texture image referenced by the 'sprite' index exists
                    if (obj.style.shademode === "sprite" && obj.style.sprite !== undefined)
                    {
                       if (!obj.textures)
                       {
                          throw new Error("Entity has shademode 'sprite' but no textures defined on parent emitter.");
                       }
                       if (obj.style.sprite > obj.textures.length - 1)
                       {
                          throw new Error("Entity has shademode 'sprite' index but references missing texture on parent emitter.")
                       }
                    }
                    ctx.globalAlpha = obj.style.opacity;
                    var coords = obj._coords;
                    if (obj.style.shademode === "plain")
                    {
                       ctx.fillStyle = "rgb(" + obj.style.color[0] + "," + obj.style.color[1] + "," + obj.style.color[2] + ")";
                    }
                    for (var i=0; i<coords.length; i++)
                    {
                       this.renderPoint(ctx, obj, scene, coords[i], i);
                    }
                 }
              }
              ctx.restore();
           }
        },

        renderPoint: function renderPoint(ctx, obj, scene, coord, index)
        {
           // perform clip of point if vertex has been marked for clipping
           if (obj._clip[index]) return;
           
           var w = obj.style.linewidth;
           if (obj.style.linescale !== 0)
           {
              // use the perspective divisor to calculate line width scaling
              // try to keep this calculation in sync with scene point clipOffset calculation
              w = (obj.style.linewidth * obj.style.linescale * scene._perspectiveScale) / obj._coords[index][3];
           }

           switch (obj.style.shademode)
           {
              case "plain":
              {
                 ctx.beginPath();
                 ctx.arc(coord[0], coord[1], w, 0, Phoria.TWOPI, true);
                 ctx.closePath();
                 ctx.fill();
                 break;
              }
              case "sprite":
              {
                 if (obj.style.sprite !== undefined)
                 {
                    ctx.drawImage(obj.textures[obj.style.sprite], coord[0]-w, coord[1]-w, w+w, w+w);
                 }
                 break;
              }
              case "callback":
              {
                 // optional rendering callback functions
                 if (obj.onRenderHandlers !== null)
                 {
                    for (var h=0; h<obj.onRenderHandlers.length; h++)
                    {
                       obj.onRenderHandlers[h].call(obj, ctx, coord[0], coord[1], w);
                    }
                 }
                 break;
              }
              case "lightsource":
              {
                 // lighting calc
                 var rgb = this.calcPositionBrightness(obj._worldcoords[index], scene.lights);
                 ctx.fillStyle = "rgb(" + Math.min(Math.ceil(rgb[0] * obj.style.color[0]),255) + "," +
                                          Math.min(Math.ceil(rgb[1] * obj.style.color[1]),255) + "," +
                                          Math.min(Math.ceil(rgb[2] * obj.style.color[2]),255) + ")";
                 ctx.beginPath();
                 ctx.arc(coord[0], coord[1], w, 0, Phoria.TWOPI, true);
                 ctx.closePath();
                 ctx.fill();
                 break;
              }
           }
        },
        
        renderEdge: function renderEdge(ctx, obj, scene, edge)
        {
           // perform clip of edge if all vertices have been marked for clipping
           if (obj._clip[edge.a] & obj._clip[edge.b]) return;
           
           var coords = obj._coords;
           
           if (obj.style.linescale !== 0)
           {
              // use the perspective divisor to calculate line width scaling
              ctx.lineWidth = ((obj.style.linewidth * obj.style.linescale) / ((obj._coords[edge.a][3] + obj._coords[edge.b][3]) * 0.5)) * scene._perspectiveScale;
           }

           // lighting calc
           if (obj.style.shademode === "lightsource")
           {
              var edgea = obj._worldcoords[edge.a], edgeb = obj._worldcoords[edge.b],
                  position = vec3.fromValues((edgea[0] + edgeb[0]) * 0.5, (edgea[1] + edgeb[1]) * 0.5, (edgea[2] + edgeb[2]) * 0.5);
              var rgb = this.calcPositionBrightness(position, scene.lights);
              ctx.beginPath();
              ctx.strokeStyle = "rgb(" + Math.min(Math.ceil(rgb[0] * obj.style.color[0]),255) + "," +
                                         Math.min(Math.ceil(rgb[1] * obj.style.color[1]),255) + "," +
                                         Math.min(Math.ceil(rgb[2] * obj.style.color[2]),255) + ")";
              // draw an edge
              ctx.moveTo(coords[edge.a][0], coords[edge.a][1]);
              ctx.lineTo(coords[edge.b][0], coords[edge.b][1]);
              ctx.closePath();
              ctx.stroke();
           }
           else
           {
              // draw an edge
              ctx.moveTo(coords[edge.a][0], coords[edge.a][1]);
              ctx.lineTo(coords[edge.b][0], coords[edge.b][1]);
           }
        },
        
        renderPolygon: function renderPolygon(ctx, obj, scene, poly)
        {
           var coords = obj._coords,
               clip = obj._clip,
               vertices = poly.vertices,
               color = poly.color ? poly.color : obj.style.color,
               fillStyle = null, rgb, emit = 0.0, opacity = (poly.opacity ? poly.opacity : obj.style.opacity);
           
           // clip of poly if all vertices have been marked for clipping
           var clippoly = 1;
           for (var i=0; i<vertices.length; i++)
           {
              clippoly &= clip[vertices[i]];
           }
           if (clippoly) return;
           
           // hidden surface removal - use area sign in screen space calculation rather than normal to camera
           // as normal dot test will only work for orthogonal projection not perspective projection
           if (!obj.style.doublesided && 
               ((coords[vertices[0]][0]*coords[vertices[1]][1] - coords[vertices[1]][0]*coords[vertices[0]][1]) +
                (coords[vertices[1]][0]*coords[vertices[2]][1] - coords[vertices[2]][0]*coords[vertices[1]][1]) +
                (coords[vertices[2]][0]*coords[vertices[0]][1] - coords[vertices[0]][0]*coords[vertices[2]][1]) < 0)) return;
           
           // generate fill style based on lighting mode
           switch (obj.style.shademode)
           {
              case "plain":
              {
                 if (obj.style.texture === undefined && poly.texture === undefined)
                 {
                    fillStyle = color[0] + "," + color[1] + "," + color[2];
                 }
                 
                 break;
              }
              
              case "lightsource":
              {
                 // this performs a pass for each light - a simple linear-additive lighting model
                 rgb = this.calcNormalBrightness(Phoria.Util.averagePolyVertex(vertices, obj._worldcoords), poly._worldnormal, scene, obj);
                 
                 if (poly.emit || obj.style.emit)
                 {
                    emit = poly.emit ? poly.emit : obj.style.emit;
                 }

                 // generate style string for canvas fill (integers in 0-255 range)
                 fillStyle = Math.min(Math.ceil(rgb[0]*color[0] + color[0]*emit),255) + "," +
                             Math.min(Math.ceil(rgb[1]*color[1] + color[1]*emit),255) + "," +
                             Math.min(Math.ceil(rgb[2]*color[2] + color[1]*emit),255);
                 
                 break;
              }
           }
           
           // render the polygon - textured or one of the solid fill modes
           ctx.save();
           if (obj.style.texture !== undefined || poly.texture !== undefined)
           {
              var bitmap = obj.textures[ poly.texture !== undefined ? poly.texture : obj.style.texture ],
                  tx0, ty0, tx1, ty1, tx2, ty2;
              var fRenderTriangle = function(vs, sx0, sy0, sx1, sy1, sx2, sy2)
              {
                 var x0 = vs[0][0], y0 = vs[0][1],
                     x1 = vs[1][0], y1 = vs[1][1],
                     x2 = vs[2][0], y2 = vs[2][1];
                 ctx.beginPath();
                 ctx.moveTo(x0, y0);
                 ctx.lineTo(x1, y1);
                 ctx.lineTo(x2, y2);
                 ctx.closePath();
                 ctx.clip();
                 
                 // Textured triangle transformation code originally by Thatcher Ulrich
                 // TODO: figure out if drawImage goes faster if we specify the rectangle that bounds the source coords.
                 // TODO: this is far from perfect - due to perspective corrected texture mapping issues see:
                 //       http://tulrich.com/geekstuff/canvas/perspective.html
                 
                 // collapse terms
                 var denom = denom = 1.0 / (sx0 * (sy2 - sy1) - sx1 * sy2 + sx2 * sy1 + (sx1 - sx2) * sy0);
                 // calculate context transformation matrix
                 var m11 = - (sy0 * (x2 - x1) - sy1 * x2 + sy2 * x1 + (sy1 - sy2) * x0) * denom,
                     m12 = (sy1 * y2 + sy0 * (y1 - y2) - sy2 * y1 + (sy2 - sy1) * y0) * denom,
                     m21 = (sx0 * (x2 - x1) - sx1 * x2 + sx2 * x1 + (sx1 - sx2) * x0) * denom,
                     m22 = - (sx1 * y2 + sx0 * (y1 - y2) - sx2 * y1 + (sx2 - sx1) * y0) * denom,
                     dx = (sx0 * (sy2 * x1 - sy1 * x2) + sy0 * (sx1 * x2 - sx2 * x1) + (sx2 * sy1 - sx1 * sy2) * x0) * denom,
                     dy = (sx0 * (sy2 * y1 - sy1 * y2) + sy0 * (sx1 * y2 - sx2 * y1) + (sx2 * sy1 - sx1 * sy2) * y0) * denom;
                 
                 ctx.transform(m11, m12, m21, m22, dx, dy);
                 
                 // Draw the whole texture image. Transform and clip will map it onto the correct output polygon.
                 ctx.globalAlpha = opacity;
                 ctx.drawImage(bitmap, 0, 0);
              };
              
              if (fillStyle !== null)
              {
                 // convert RGB to grey scale level
                 var alpha = rgb[0]*0.3 + rgb[1]*0.6 + rgb[2]*0.1;
                 if (alpha > 1.0) alpha = 1.0;
                 // fix to N decimal places to avoid eExp notation on toString()!
                 ctx.fillStyle = "rgba(" + fillStyle + "," + (1.0 - alpha).toFixed(3) + ")";
              }
              
              // we can only deal with triangles for texturing - a quad must be split into two triangles
              // TODO: needs a triangle subdivision algorithm for > 4 verticies
              if (vertices.length === 3)
              {
                 tx0 = 0, ty0 = 0, tx1 = bitmap.width, ty1 = 0, tx2 = bitmap.width, ty2 = bitmap.height;
                 if (poly.uvs !== undefined)
                 {
                    tx0 = bitmap.width * poly.uvs[0]; ty0 = bitmap.height * poly.uvs[1];
                    tx1 = bitmap.width * poly.uvs[2]; ty1 = bitmap.height * poly.uvs[3];
                    tx2 = bitmap.width * poly.uvs[4]; ty2 = bitmap.height * poly.uvs[5];
                 }
                 // TODO: Chrome does not need the texture poly inflated!
                 var inflatedVertices = this.inflatePolygon(vertices, coords, 0.5);
                 fRenderTriangle.call(this, inflatedVertices, tx0, ty0, tx1, ty1, tx2, ty2);
                 // apply optional color fill to shade and light the texture image
                 if (fillStyle !== null)
                 {
                    ctx.fill();
                 }
              }
              else if (vertices.length === 4)
              {
                 tx0 = 0, ty0 = 0, tx1 = bitmap.width, ty1 = 0, tx2 = bitmap.width, ty2 = bitmap.height;
                 if (poly.uvs !== undefined)
                 {
                    tx0 = bitmap.width * poly.uvs[0]; ty0 = bitmap.height * poly.uvs[1];
                    tx1 = bitmap.width * poly.uvs[2]; ty1 = bitmap.height * poly.uvs[3];
                    tx2 = bitmap.width * poly.uvs[4]; ty2 = bitmap.height * poly.uvs[5];
                 }
                 ctx.save();
                 // TODO: Chrome does not need the texture poly inflated!
                 var inflatedVertices = this.inflatePolygon(vertices.slice(0, 3), coords, 0.5);
                 fRenderTriangle.call(this, inflatedVertices, tx0, ty0, tx1, ty1, tx2, ty2);
                 ctx.restore();

                 tx0 = bitmap.width, ty0 = bitmap.height, tx1 = 0, ty1 = bitmap.height, tx2 = 0, ty2 = 0;
                 if (poly.uvs !== undefined)
                 {
                    tx0 = bitmap.width * poly.uvs[4]; ty0 = bitmap.height * poly.uvs[5];
                    tx1 = bitmap.width * poly.uvs[6]; ty1 = bitmap.height * poly.uvs[7];
                    tx2 = bitmap.width * poly.uvs[0]; ty2 = bitmap.height * poly.uvs[1];
                 }
                 ctx.save();
                 var v = new Array(3);
                 v[0] = vertices[2];
                 v[1] = vertices[3];
                 v[2] = vertices[0];
                 // TODO: Chrome does not need the texture poly inflated!
                 inflatedVertices = this.inflatePolygon(v, coords, 0.5);
                 fRenderTriangle.call(this, inflatedVertices, tx0, ty0, tx1, ty1, tx2, ty2);
                 ctx.restore();

                 // apply optional color fill to shade and light the texture image
                 if (fillStyle !== null)
                 {
                    // TODO: better to inflate again or fill two tris as above?
                    inflatedVertices = this.inflatePolygon(vertices, coords, 0.75);
                    ctx.beginPath();
                    ctx.moveTo(inflatedVertices[0][0], inflatedVertices[0][1]);
                    for (var i=1, j=inflatedVertices.length; i<j; i++)
                    {
                       ctx.lineTo(inflatedVertices[i][0], inflatedVertices[i][1]);
                    }
                    ctx.closePath();
                    ctx.globalAlpha = opacity;
                    ctx.fill();
                 }
              }
           }
           else
           {
              // solid colour fill
              if (obj.style.fillmode === "inflate")
              {
                 // inflate the polygon screen coords to cover the 0.5 pixel cracks between canvas fill()ed polygons
                 var inflatedVertices = this.inflatePolygon(vertices, coords, 0.5);
                 ctx.beginPath();
                 ctx.moveTo(inflatedVertices[0][0], inflatedVertices[0][1]);
                 for (var i=1, j=vertices.length; i<j; i++)
                 {
                    ctx.lineTo(inflatedVertices[i][0], inflatedVertices[i][1]);
                 }
                 ctx.closePath();
              }
              else
              {
                 ctx.beginPath();
                 // move to first point in the polygon
                 ctx.moveTo(coords[vertices[0]][0], coords[vertices[0]][1]);
                 for (var i=1; i<vertices.length; i++)
                 {
                    // move to each additional point
                    ctx.lineTo(coords[vertices[i]][0], coords[vertices[i]][1]);
                 }
                 // no need to plot back to first point - as path closes shape automatically
                 ctx.closePath();
              }
              
              fillStyle = "rgba(" + fillStyle + "," + opacity + ")";
              switch (obj.style.fillmode)
              {
                 case "fill":
                    // single fill - fastest but leaves edge lines
                    ctx.fillStyle = fillStyle;
                    ctx.fill();
                    break;
                 
                 case "filltwice":
                    // double fill causes "overdraw" towards edges - slightly slower
                    // but removes enough of the cracks for dense objects and small faces
                    ctx.fillStyle = fillStyle;
                    ctx.fill();
                    ctx.fill();
                    break;
                 
                 case "inflate":
                    // inflate (also called 'buffering') the polygon in 2D by a small ammount
                    // and then a single fill can be used - increase in pre calculation time
                    ctx.fillStyle = fillStyle;
                    ctx.fill();
                    break;
                 
                 case "fillstroke":
                    // single fill - followed by a stroke line - nicer edge fill but slower
                    ctx.fillStyle = fillStyle;
                    ctx.fill();
                    ctx.strokeStyle = fillStyle;
                    ctx.stroke();
                    break;
                 
                 case "hiddenline":
                    // stroke only - to produce hidden line wire effect
                    ctx.strokeStyle = fillStyle;
                    ctx.stroke();
                    break;
              }
           }
           ctx.restore();
        }
     });
  })();

  return Phoria.CanvasRenderer;

});