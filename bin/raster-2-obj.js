#!/usr/bin/env node
'use strict'

const exec 			= require('child_process').exec
const async 		= require('async')
const argv 			= require('optimist').argv
const path  		= require('path')
const fs 				= require('fs')
const poly2tri 	= require('poly2tri')
const jimp 			= require("jimp")

const potrace 	= `${__dirname}${path.sep}..${path.sep}tools${path.sep}potrace`


const polygonToOBJ = function (geometry, opts) {
	opts.OBJ += `o ${opts.fileName}_object_${opts.count}\n`							
	let   id = 0
	
	const points 	= geometry.coordinates[0].map(
		p => { return {x:p[0], y:p[1]} }
	).filter(
		(it, index, ar) => ar.find( 
				(cur) => (it !== cur) && (cur.x === it.x) && (cur.y === it.y)
			) === undefined
	)

	points.forEach(
		p => p.id = ++id
	)

	const pointsLength = points.length

	poly2tri.noConflict()
	const swctx = new poly2tri.SweepContext(points, {cloneArrays:true})
	try {
		swctx.triangulate()
	} catch (ex) {
		return
	}
	const tris 		= swctx.getTriangles()
	const output 	= argv.xz ? (x,y,z) => `\tv ${x} ${z} ${y}\n` : (x,y,z) => `\tv ${x} ${y} ${z}\n`
	points.forEach(
		p => opts.OBJ += output(p.x * opts.scale, p.y * opts.scale, 0)
	)
	points.forEach(
		p => opts.OBJ += output(p.x * opts.scale, p.y * opts.scale, opts.depth)
	)
		
	const short = (i, p, o) =>tris[i].getPoint(p).id + o
	let 	off = opts.vertexCount

	opts.OBJ += `\tg ${opts.fileName}_bottom_${opts.count}\n`
	for (let i = 0, len = tris.length; i < len; ++i) {
		opts.OBJ += `\tf ${short(i,0,off)} ${short(i,1,off)} ${short(i,2,off)}\n`
	}

	off = opts.vertexCount + pointsLength
	opts.OBJ += `\tg ${opts.fileName}_top_${opts.count}\n`
	for (let i = 0, len = tris.length; i < len; ++i) {
		opts.OBJ += `\tf ${short(i,0,off)} ${short(i,1,off)} ${short(i,2,off)}\n`
	}
	
	opts.OBJ += `\tg ${opts.fileName}_walls_${opts.count}\n`
	opts.OBJ +=  `s 1`
	for (let i = 0; i < pointsLength; ++i) {
		const j = (i + 1) % pointsLength
		const i1 = i + opts.vertexCount + 1
		const i2 = j + opts.vertexCount + 1
		const i3 = i1 + pointsLength
		const i4 = i2  + pointsLength
		opts.OBJ += `\tf ${i1} ${i2} ${i3}\n`
		opts.OBJ += `\tf ${i3} ${i2} ${i4}\n`										
	}
	opts.vertexCount += pointsLength * 2	
} 

async.each(argv._, 
	(file, callbackEach) => {
		const fileOut = `${file}.json`
		const fileOBJ = `${file}.obj`
		const fileName = path.basename(file, path.extname(file)) 
		async.waterfall([
			(callbackWaterfall) => {
				jimp.read(file, callbackWaterfall)
			},	
			(input, callbackWaterfall) => {
				file += ".bmp"
				input.write(file, callbackWaterfall)
			},
			(input, callbackWaterfall) => {				
				const cmd = `${potrace} -b geojson ${file} -o ${fileOut}`
				exec(cmd, (error, stdout, stderr) => {					
					callbackWaterfall(error)
				})
			},
			(callbackWaterfall) => {
				fs.readFile(fileOut, 'utf8', callbackWaterfall)
			},
			(data, callbackWaterfall) => {
				const parsedJSON = JSON.parse(data)
				const opts = {
					count:0,
					vertexCount:0,
					OBJ:"",
					fileName:fileName,
					depth:argv.depth || 2,
					scale:argv.scale || 1
				}

				async.each(parsedJSON.features,
					(feature, next) => {
						const geometry = feature.geometry
						if (geometry && geometry.type === "Polygon" && geometry.coordinates) {
							polygonToOBJ(geometry, opts)
							opts.count++
						}
						next()
					},
					() => {
						callbackWaterfall(null, opts.OBJ)
					}
				)
			},
			(OBJ, callbackWaterfall) => {
				fs.writeFile(fileOBJ, OBJ, callbackWaterfall)
			}
		], callbackEach)				
	},
	(err) => {
 		if( err ) {
      console.log('A file failed to process ' + err);
    } else {
      console.log('All files have been processed successfully');
    }		
	}
)
