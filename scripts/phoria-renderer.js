/**
 * @fileoverview phoria - Scene renderers. Canvas renderer and prototype Software renderer.
 * @author Kevin Roast
 * @date 14th April 2013
 */

(function() {
   "use strict";

   /**
    * Base Renderer that defines helper functions used by specific rendering classes.
    */
   Phoria.Renderer = function()
   {
   };
   
   Phoria.Renderer.prototype = {
      // {boolean} true to sort the objects in the scene by average Z coordinate, false to render the list without sorting
      sort: true,
      
      /**
       * Sort the list of objects in the scene by average Z coordinate. Prepares the flattened render
       * list to be rendered object by object using the painters algorithm.
       * 
       * @param scene {Phoria.Scene}
       */
      sortObjects: function sortObjects(scene)
      {
         // calculate and sort objects in average Z order
         if (this.sort)
         {
            for (var n=0,obj; n<scene.renderlist.length; n++)
            {
               // ensure we have an average z coord for the objects to test
               obj = scene.renderlist[n];
               switch (obj.style.objectsortmode)
               {
                  case "sorted":
                     // average z coord is calculated during scene processing
                     break;
                  case "front":
                     // to the front - remember the Z direction is reversed
                     obj._averagez = Number.MIN_VALUE;
                     break;
                  case "back":
                  default:
                     // to the back - remember the Z direction is reversed
                     obj._averagez = Number.MAX_VALUE;
                     break;
               }
            }
            scene.renderlist.sort(function sortObjectsZ(a, b) {
               return (a._averagez < b._averagez ? 1 : -1);
            });
         }
      },

      /**
       * Calculate brightness for the normal based on a set of lights
       * 
       * @param position {vec3}        Position of the source polygon e.g. vertex or average poly point
       * @param normal {vec3}          Normal to calculate brightness against
       * @param scene {Phoria.Scene}   Scene - lights and current camera position are queried from here
       * @param obj {Phoria.Entity}    Object - style is used for diffuse/specular calculations
       * @return RGB float component array for final brightness - values added to current values
       */
      calcNormalBrightness: function calcNormalBrightness(position, normal, scene, obj)
      {
         var rgb = [0.0,0.0,0.0],
             lights = scene.lights;
         for (var e=0, light, brightness; e<lights.length; e++)
         {
            light = lights[e];
            
            if (light instanceof Phoria.DistantLight)
            {
               // Distant lights have no "position", just a direction - they light the world with parallel rays
               // from an infinitely distant location - closest example is light from the sun when overhead
               // note that light worlddirection is precalculated as negative.
               var dotVP = vec3.dot(normal, light.worlddirection);
               
               // don't waste any more time calculating if the dot product is negative i.e. > 90 degrees
               if (dotVP <= 0) continue;
               
               // combine light intensity with dot product and object diffuse value
               brightness = dotVP * light.intensity * obj.style.diffuse;
            }
            else if (light instanceof Phoria.PointLight)
            {
               // Point lights have a position and a fall-off known as attenuation
               // distance falloff calculation - each light is additive to the total
               var vecToLight = vec3.subtract(vec3.create(), position, light.worldposition),
                   distance = vec3.length(vecToLight),
                   attenuation;
               vec3.normalize(vecToLight, vecToLight);
               var dotVP = vec3.dot(normal, vec3.negate(vecToLight, vecToLight));
               
               // don't waste any more time calculating if the dot product is negative i.e. > 90 degrees
               if (dotVP <= 0) continue;
               
               switch (light.attenuationFactor)
               {
                  default:
                  case "none":
                     attenuation = light.attenuation;
                     break;
                  case "linear":
                     attenuation = light.attenuation * distance;
                     break;
                  case "squared":
                     attenuation = light.attenuation * distance * distance;
                     break;
               }
               
               // Optional specular highlight calculation
               if (obj.style.specular !== 0)
               {
                  var halfV = vec3.add(vec3.create(), vecToLight, scene._cameraPosition),
                      dotHV = vec3.dot(normal, vec3.normalize(halfV, halfV)),
                      pf = Math.pow(dotHV, obj.style.specular) * light.intensity / attenuation;
                  rgb[0] += pf * light.color[0];
                  rgb[1] += pf * light.color[1];
                  rgb[2] += pf * light.color[2];
               }
               
               brightness = obj.style.diffuse * dotVP * light.intensity / attenuation;
            }
            
            // apply each colour component based on light levels (0.0 to 1.0)
            rgb[0] += brightness * light.color[0];
            rgb[1] += brightness * light.color[1];
            rgb[2] += brightness * light.color[2];
         }
         return rgb;
      },

      /**
       * Calculate brightness for the position based on a set of lights. It is assumed the entity at the position
       * has no normal vector i.e. it is a point in space only.
       * 
       * @param position {vec3}  Position of the source polygon e.g. vertex or average poly point
       * @param lights {Array}   Array of light entities to process
       * @return RGB float component array for final brightness - values added to current values
       */
      calcPositionBrightness: function calcPositionBrightness(position, lights)
      {
         var rgb = [0.0,0.0,0.0];
         for (var e=0, light, brightness; e<lights.length; e++)
         {
            light = lights[e];
            
            if (light instanceof Phoria.DistantLight)
            {
               // Distant lights have no "position"
               brightness = light.intensity;
            }
            else if (light instanceof Phoria.PointLight)
            {
               // Point lights have a position and a fall-off known as attenuation
               var vecToLight = vec3.subtract(vec3.create(), position, light.worldposition),
                   distance = vec3.length(vecToLight),
                   attenuation;
               vec3.normalize(vecToLight, vecToLight);
               
               switch (light.attenuationFactor)
               {
                  case "linear":
                     attenuation = light.attenuation * distance;
                     break;
                  case "squared":
                     attenuation = light.attenuation * distance * distance;
                     break;
                  default:
                  case "none":
                     attenuation = light.attenuation;
                     break;
               }
               
               // NOTE: increasing attenuation to try to light wires similar brightness to polygons that
               //       are lit by the same light - other options would be to properly calculate the lighting
               //       normal based on the polygons that share the edges - this would mean more complicated
               //       object descriptions - but provide much more accurate wireframe/point lighting...
               brightness = light.intensity / (attenuation * 2);
            }
            
            // apply each colour component based on light levels (0.0 to 1.0)
            rgb[0] += brightness * light.color[0];
            rgb[1] += brightness * light.color[1];
            rgb[2] += brightness * light.color[2];
         }
         return rgb;
      },

      /**
       * Inflate the vertices of a polygon - see inflatePolygonFull() below for a richer impl - this
       * algorithm is not quite as neat and suffers when the camera lines up exactly with perpendicular
       * edges - however it is much, much faster.
       */
      inflatePolygon: function inflatePolygon(vertices, coords, pixels)
      {
         pixels = pixels || 0.5;
         var inflatedVertices = new Array(vertices.length);
         for (var i=0; i<vertices.length; i++)
         {
            inflatedVertices[i] = [ coords[vertices[i]][0], coords[vertices[i]][1] ];
         }
         for (var i=0, j=vertices.length,k,x1,y1,x2,y2,dx,dy,len; i<j; i++)
         {
            k = (i < j - 1) ? (i+1) : 0;
            x1 = inflatedVertices[i][0];
            y1 = inflatedVertices[i][1];
            x2 = inflatedVertices[k][0];
            y2 = inflatedVertices[k][1];
            var x = x2 - x1, y = y2 - y1,
                det = x * x + y * y, idet;

            if (det === 0) det === Phoria.EPSILON;

            idet = pixels / Math.sqrt(det);

            x *= idet; y *= idet;

            inflatedVertices[i][0] -= x;
            inflatedVertices[i][1] -= y;
            inflatedVertices[k][0] += x;
            inflatedVertices[k][1] += y;
         }
         return inflatedVertices;
      },

      /**
       * Inflate polygon by 0.5 screen pixels to cover cracks generates by the canvas 2D shape fill convention.
       *  see http://stackoverflow.com/questions/3749678/expand-fill-of-convex-polygon
       *  and http://stackoverflow.com/questions/1109536/an-algorithm-for-inflating-deflating-offsetting-buffering-polygons
       * This neat routine means that the gaps between polygons seen in other Canvas based renders are not present. It adds
       * a few percent overhead in CPU processing, but that is much less than the canvas overhead of multiple fill() or other
       * techniques commonly used to hide the polygon cracks. Also the multiple fill or fill then stroke techniques will not
       * work with textured polygons.
       */
      inflatePolygonFull: function inflatePolygonFull(vertices, coords, pixels)
      {
         pixels = pixels || 0.5;
         // generate vertices of parallel edges
         var pedges = [], inflatedVertices = new Array(vertices.length);
         for (var i=0, j=vertices.length, x1,y1,x2,y2,dx,dy,len; i<j; i++)
         {
            // collect an edge
            x1 = coords[vertices[i]][0];
            y1 = coords[vertices[i]][1];
            if (i < j - 1)
            {
               x2 = coords[vertices[i+1]][0];
               y2 = coords[vertices[i+1]][1];
            }
            else
            {
               x2 = coords[vertices[0]][0];
               y2 = coords[vertices[0]][1];
            }
            
            // compute outward facing normal vector - and normalise the length
            dx = y2 - y1;
            dy = -(x2 - x1);
            len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
            
            // multiply by the distance to the parallel edge
            dx *= pixels;
            dy *= pixels;
            
            // generate and store parallel edge
            pedges.push({x: x1 + dx, y: y1 + dy});
            pedges.push({x: x2 + dx, y: y2 + dy});
         }
         
         // calculate intersections to build new screen coords for inflated poly
         for (var i=0, j=vertices.length, vec; i<j; i++)
         {
            if (i === 0)
            {
               vec = this.intersection(pedges[(j-1) * 2], pedges[(j-1) * 2 + 1], pedges[0], pedges[1]);
            }
            else
            {
               vec = this.intersection(pedges[(i-1) * 2], pedges[(i-1) * 2 + 1], pedges[i * 2], pedges[i * 2 + 1]);
            }
            // handle edge case (haha) where inflated polygon vertex edges jump towards infinity
            if (Math.abs(vec[0] - coords[vertices[i]][0]) > 1.5 || Math.abs(vec[1] - coords[vertices[i]][1]) > 1.5)
            {
               // reset to original coordinates
               vec[0] = coords[vertices[i]][0];
               vec[1] = coords[vertices[i]][1];
            }
            inflatedVertices[i] = vec;
         }
         
         return inflatedVertices;
      },
      
      intersection: function intersection(line0v0, line0v1, line1v0, line1v1)
      {
         var a1 = line0v1.x - line0v0.x,
             b1 = line1v0.x - line1v1.x,
             c1 = line1v0.x - line0v0.x,
             a2 = line0v1.y - line0v0.y,
             b2 = line1v0.y - line1v1.y,
             c2 = line1v0.y - line0v0.y,
             t = (b1*c2 - b2*c1) / (a2*b1 - a1*b2);
         
         return [
            line0v0.x + t * (line0v1.x - line0v0.x),
            line0v0.y + t * (line0v1.y - line0v0.y)
         ];
      }
   };
})();


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


(function() {
   "use strict";

   /**
    * Software renderer is based on the work by mr.doob which in turn is based on the work here:
    * http://devmaster.net/forums/topic/1145-advanced-rasterization/
    * For lots of small polygons in a very fast JavaScript VM (V8 on Chrome) then it can be faster than
    * standard canvas poly drawing - but does not have anti-aliasing and is notably slower for large polygons.
    */
   Phoria.SoftwareRenderer = function(canvas)
   {
      Phoria.SoftwareRenderer.superclass.constructor.call(this);

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this._imagedata = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this._data = this._imagedata.data;

      return this;
   };
   
   Phoria.Util.extend(Phoria.SoftwareRenderer, Phoria.Renderer, {
      // canvas to use as the output context
      canvas: null,
      ctx: null,
      _imagedata: null,
      _data: null,
      
      /**
       * Render the given scene to the canvas context
       * 
       * @param {Phoria.Scene} scene   The scene to render - processed by scene.modelView()
       */
      render: function render(scene)
      {
         this.sortObjects(scene);
         
         // clear the canvas before rendering begins
         // TODO: optimize with prevrect - see SoftwareRenderer
         this.clearCanvasRect(0, 0, this.canvas.width, this.canvas.height);
         //this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
         //this._imagedata = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
         //this._data = this._imagedata.data;

         // scene performs all local, world and projection calculations and flattens the rendering list ready for rendering.
         for (var n=0, obj; n<scene.renderlist.length; n++)
         {
            obj = scene.renderlist[n];
            
            switch (obj.style.drawmode)
            {
               case "solid":
               {
                  // render the pre-sorted polygons
                  var rendercount = 0;
                  for (var i=0; i<obj.polygons.length; i++)
                  {
                     if (this.renderPolygon(null, obj, scene, obj.polygons[i])) rendercount++;
                  }
                  //if (Date.now() % 25 === 0) console.log(rendercount);
                  break;
               }
            }
         }

         // TODO: optimize with prev rect - see SoftwareRenderer
         this.ctx.putImageData(this._imagedata, 0, 0, 0, 0, this.canvas.width, this.canvas.height);
      },

      clearCanvasRect: function clearCanvasRect(xmin, ymin, xmax, ymax)
      {
         // TODO: optimize with prevrect - see SoftwareRenderer
         var offset = (xmin + ymin * this.canvas.width - 1) * 4 + 3,
             linestep = (this.canvas.width - (xmax - xmin)) * 4,
             data = this._data;
         for (var y = ymin; y < ymax; y++)
         {
            for (var x = xmin; x < xmax; x++)
            {
               data[offset += 4] = 0;
            }
            offset += linestep;
         }
      },
      
      renderPolygon: function renderPolygon(ctx, obj, scene, poly)
      {
         var coords = obj._coords,
             clip = obj._clip,
             vertices = poly.vertices,
             color = poly.color ? poly.color : obj.style.color;

         // clip of poly if all vertices have been marked for clipping
         var clippoly = 1;
         for (var i=0; i<vertices.length; i++)
         {
            clippoly &= clip[vertices[i]];
         }
         if (clippoly) return false;
         
         // hidden surface removal
         if (!obj.style.doublesided && 
             ((coords[vertices[0]][0]*coords[vertices[1]][1] - coords[vertices[1]][0]*coords[vertices[0]][1]) +
              (coords[vertices[1]][0]*coords[vertices[2]][1] - coords[vertices[2]][0]*coords[vertices[1]][1]) +
              (coords[vertices[2]][0]*coords[vertices[0]][1] - coords[vertices[0]][0]*coords[vertices[2]][1]) < 0)) return;
         
         // generate fill style based on lighting mode
         var rgb;
         switch (obj.style.shademode)
         {
            case "plain":
            {
               rgb = new Array(3);
               rgb[0] = color[0];
               rgb[1] = color[1];
               rgb[2] = color[2];

               break;
            }
            
            case "lightsource":
            {
               // perform a pass for each light - a simple linear-additive lighting model
               rgb = this.calcNormalBrightness(Phoria.Util.averagePolyVertex(vertices, obj._worldcoords), poly._worldnormal, scene, obj);

               // generate final RGB
               rgb[0] = Math.ceil(Math.min(rgb[0]*color[0], 255));
               rgb[1] = Math.ceil(Math.min(rgb[1]*color[1], 255));
               rgb[2] = Math.ceil(Math.min(rgb[2]*color[2], 255));
               
               break;
            }
         }
         
         // render a triangle in software to a buffer
         this.drawTriangle(
            coords[vertices[2]][0], coords[vertices[2]][1],
            coords[vertices[1]][0], coords[vertices[1]][1],
            coords[vertices[0]][0], coords[vertices[0]][1],
            rgb[0], rgb[1], rgb[2]);
         // handle quad - split into second triangle
         // TODO: polygon subvision is needed for >4 verts if this renderer is used...
         if (vertices.length === 4)
         {
            this.drawTriangle(
               coords[vertices[0]][0], coords[vertices[0]][1],
               coords[vertices[3]][0], coords[vertices[3]][1],
               coords[vertices[2]][0], coords[vertices[2]][1],
               rgb[0], rgb[1], rgb[2]);
         }
         return true;
      },

      drawTriangle: function drawTriangle(x1, y1, x2, y2, x3, y3, r, g, b)
      {
         // http://devmaster.net/forums/topic/1145-advanced-rasterization/

         // 28.4 fixed-point coordinates
         var x1 = Math.round( 16 * x1 ),
             x2 = Math.round( 16 * x2 ),
             x3 = Math.round( 16 * x3 ),
             y1 = Math.round( 16 * y1 ),
             y2 = Math.round( 16 * y2 ),
             y3 = Math.round( 16 * y3 );

         // Deltas
         var dx12 = x1 - x2,
             dx23 = x2 - x3,
             dx31 = x3 - x1,
             dy12 = y1 - y2,
             dy23 = y2 - y3,
             dy31 = y3 - y1;

         // Fixed-point deltas
         var fdx12 = dx12 << 4,
             fdx23 = dx23 << 4,
             fdx31 = dx31 << 4,
             fdy12 = dy12 << 4,
             fdy23 = dy23 << 4,
             fdy31 = dy31 << 4;

         var canvasWidth = this.canvas.width,
             canvasHeight = this.canvas.height,
             data = this._data;

         // Bounding rectangle
         var xmin = Math.max( ( Math.min( x1, x2, x3 ) + 0xf ) >> 4, 0 ),
             xmax = Math.min( ( Math.max( x1, x2, x3 ) + 0xf ) >> 4, canvasWidth ),
             ymin = Math.max( ( Math.min( y1, y2, y3 ) + 0xf ) >> 4, 0 ),
             ymax = Math.min( ( Math.max( y1, y2, y3 ) + 0xf ) >> 4, canvasHeight );
         
         if (xmax <= xmin || ymax <= ymin) return;

         //rectx1 = Math.min( xmin, rectx1 );
         //rectx2 = Math.max( xmax, rectx2 );
         //recty1 = Math.min( ymin, recty1 );
         //recty2 = Math.max( ymax, recty2 );

         // Constant part of half-edge functions
         var c1 = dy12 * x1 - dx12 * y1,
             c2 = dy23 * x2 - dx23 * y2,
             c3 = dy31 * x3 - dx31 * y3;

         // Correct for fill convention
         if ( dy12 < 0 || ( dy12 == 0 && dx12 > 0 ) ) c1++;
         if ( dy23 < 0 || ( dy23 == 0 && dx23 > 0 ) ) c2++;
         if ( dy31 < 0 || ( dy31 == 0 && dx31 > 0 ) ) c3++;

         var cy1 = c1 + dx12 * ( ymin << 4 ) - dy12 * ( xmin << 4 ),
             cy2 = c2 + dx23 * ( ymin << 4 ) - dy23 * ( xmin << 4 ),
             cy3 = c3 + dx31 * ( ymin << 4 ) - dy31 * ( xmin << 4 ),
             cx1, cx2, cx3;

         // Scan through bounding rectangle
         for (var y = ymin,x,offset; y < ymax; y++)
         {
            // Start value for horizontal scan
            cx1 = cy1;
            cx2 = cy2;
            cx3 = cy3;
            for (x = xmin; x < xmax; x++)
            {
               if (cx1 > 0 && cx2 > 0 && cx3 > 0)
               {
                  offset = (x + y * canvasWidth) << 2;
                  data[ offset ] = r;
                  data[ offset + 1 ] = g;
                  data[ offset + 2 ] = b;
                  data[ offset + 3 ] = 255;
               }
               cx1 -= fdy12;
               cx2 -= fdy23;
               cx3 -= fdy31;
            }
            cy1 += fdx12;
            cy2 += fdx23;
            cy3 += fdx31;
         }
      }
   });
})();
