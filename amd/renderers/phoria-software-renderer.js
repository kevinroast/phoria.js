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

  return Phoria.SoftwareRenderer;

});