'use strict';

const exec = require('child_process').exec;
const async = require('async')
const argv = require('optimist').argv
const path  = require('path')
const fs = require('fs');
const delaunay = require('delaunay')
const poly2tri = require('poly2tri');

const potrace = `.${path.sep}tools${path.sep}potrace`
const depth = argv.depth || 10
const scale = argv.scale || 1
async.each(argv._, 
	function(file, callbackEach) {
		const fileOut = `${file}.json`
		const fileOBJ = `${file}.obj`
		const fileName = path.basename(file, path.extname(file)) 
		async.waterfall([
			function(callbackWaterfall) {				
				const cmd = `${potrace} -b geojson ${file} -o ${fileOut}`
				console.log(cmd)
				exec(cmd, function(error, stdout, stderr) {					
					callbackWaterfall(error)
				})
			},
			function(callbackWaterfall) {
				fs.readFile(fileOut, 'utf8', callbackWaterfall)
			},
			function(data, callbackWaterfall) {				
				const parsedJSON = JSON.parse(data);
				
				let OBJ = ""
				let count = 0				
				let vertexCount = 0
				parsedJSON.features.forEach(
					function(feature) {						
						const geometry = feature.geometry
						if (geometry && geometry.type && geometry.coordinates) {
							switch(geometry.type) {
								case "Polygon":		
									OBJ += `o ${fileName}_object_${count}\n`							
									let   id = 0
									const points 	= geometry.coordinates[0].map(
										p => { return {x:p[0], y:p[1], id:++id}}
									)
																	
									{
										const len 		= points.length
										if ( (points[0].x === points[len - 1].x) 
											&& (points[0].y === points[len - 1].y) ) {
											points.pop()
										}									
									}
									const pointsLength = points.length
									
									poly2tri.noConflict();									
									const swctx = new poly2tri.SweepContext(points, {cloneArrays:true});
									swctx.triangulate();

									const tris 		= swctx.getTriangles()

									points.forEach(
										p => OBJ += `\tv ${p.x * scale} ${p.y * scale} 0\n`
									)
									points.forEach(
										p => OBJ += `\tv ${p.x * scale} ${p.y * scale} ${depth}\n`
									)
									
									
									const short = (i, p, o) =>tris[i].getPoint(p).id + o
									let 	off = vertexCount
									OBJ += `\tg ${fileName}_bottom_${count}\n`
									for (let i = 0, len = tris.length; i < len; ++i) {
										OBJ += `\tf ${short(i,0,off)} ${short(i,1,off)} ${short(i,2,off)}\n`
									}

									off = vertexCount + pointsLength
									OBJ += `\tg ${fileName}_top_${count}\n`
									for (let i = 0, len = tris.length; i < len; ++i) {
										OBJ += `\tf ${short(i,0,off)} ${short(i,1,off)} ${short(i,2,off)}\n`
									}
									
									OBJ += `\tg ${fileName}_walls_${count}\n`
									for (let i = 0; i < pointsLength; ++i) {
										const j = (i + 1) % pointsLength
										const i1 = i + vertexCount + 1
										const i2 = j + vertexCount + 1
										const i3 = i1 + pointsLength
										const i4 = i2  + pointsLength
										OBJ += `\tf ${i1} ${i2} ${i3}\n`
										OBJ += `\tf ${i3} ${i2} ${i4}\n`										
									}

									

									vertexCount += pointsLength * 2
									break;
							}							
							count++;
						}
					}
				)				
				callbackWaterfall(null, OBJ)
			},
			function(OBJ, callbackWaterfall) {
				fs.writeFile(fileOBJ, OBJ, callbackWaterfall)
			}
		], callbackEach)				
	},
	function (err) {
 		if( err ) {
      console.log('A file failed to process ' + err);
    } else {
      console.log('All files have been processed successfully');
    }		
	}
)
