# raster-2-obj, convert raster to and OBJ file
Use potrace to vectorize a bitmap, then transform the vector into a 3d file by extruding it.

#install
```
	npm install -g raster-2-obj
```

# usage
raster-2-obj file.bmp [--xz] [--scale=1] [--depth=2]
* --xz depth is written on the Y component instead of Z
* --scale multiply X,Y value by this
* --depth extrude value. 