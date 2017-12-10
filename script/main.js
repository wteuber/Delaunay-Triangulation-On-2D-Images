$(document).ready(function () {
	// Initialization
	var ME = {
		// default configuration
		DEFAULT: {
			//（0~255）edge detection threshold
			EDGE_DETECT_VALUE: 80,
			// points generation rate along edges
			POINT_RATE: 0.04,
			// max number of random sample points
			POINT_MAX_NUM: 4500,
			// edge blur size
			BLUR_SIZE: 2,
			// edge points sampled
			EDGE_SIZE: 4,
			// image pixel limit
			PIXEL_LIMIT: 8000000
		},
		USE: {
			beginTime: null,
			endTime: null,
			sourceImg: null,
			defaultImg: new Image(),
			canvas: null,
			context: null,
			imgData: [],
			origin: {}
		},
		DOM: {
			$sourceWrapper: $('#source-wrapper'),
			$sourceInput: $('#source-input'),
			$imgWrapper: $('#img-wrapper'),
			$setWrapper: $('#set-wrapper'),
			$setInputs: $('#set-wrapper>input'),
			$runBtn: $('#run-btn'),
			$downloadBtn: $('#download-btn'),
			$resetBtn: $('#reset-btn'),
			$prompt: $('#prompt')
		},
		METHODS: {},
		WOK: {}
	};
	// 线程生成方法姑且写成一个工厂方法，目前只用到一个线程
	ME.METHODS.FactoryWorker = function (workerUrl) {
		if (!window.Worker) return alert('Your browser does not support worker');
		var worker = new Worker(workerUrl),
			$event = $({});
		worker.onmessage = function (event) {
				var EData = event.data,
					type = EData.type,
					data = EData.data;
				$event.trigger(type, data);
			}
			// 加上一层包装用于与线程通讯
		return {
			emit: function (type, data) {
				worker.postMessage({
					type: type,
					data: data
				});
			},
			on: function (type, fn) {
				$event.on(type, fn);
			},
			off: function (type, fn) {
				$event.off(type, fn);
			}
		};
	};

	//设置input默认的选项值
	ME.METHODS.setDeault = function () {
		var set = ME.DEFAULT,
			key = null,
			value = null;
		ME.DOM.$setInputs.each(function (i, item) {
			key = item.name;
			value = set[key];
			if (!value) return;
			item.value = value;
		});
	};
	//更新选项值
	ME.METHODS.updateDefault = function () {
		var set = ME.DEFAULT,
			key = null,
			value = null;
		ME.DOM.$setInputs.each(function (i, item) {
			key = item.name;
			value = item.value;
			if (!set[key]) return;
			set[key] = value;
		});
	};
	//用于设置拖拽图片的的源
	ME.METHODS.loadImg = function (src, callback) {
		//这里使用了代理可以获取到图片的原始数据
		var tempImg = new Image();
		tempImg.src = src;
		tempImg.onload = function (event) {
			//这边只是用于预览用的
			ME.DOM.$imgWrapper.prop('src', src);
			//传入的原始是图片数据
			callback(tempImg);
		}

	}

	//用与生成通用createURL
	ME.METHODS.createUrl = (function () {
		return window.createObjectURL || window.URL.createObjectURL || window.webkitURL.createObjectURL || alert('浏览器器太久了，改换了');
	})();


	//用于获取图片的源路径
	ME.METHODS.getImgSrc = function (source) {
		var type = source.type.substr(0, 5);
		if (type !== 'image') return console.log('Image is needed！');
		return ME.METHODS.createUrl(source);
	}


	//用于设置图片的属性
	ME.METHODS.setImg = function (img) {
			var width = img.width,
				height = img.height,
				pixelNum = width * height,
				pixelLimit = ME.DEFAULT.PIXEL_LIMIT;
			if (pixelNum > pixelLimit) {
				var scale = Math.sqrt(pixelLimit / pixelNum);
				img.width = width * scale | 0;
				img.height = height * scale | 0;
			}
			ME.USE.origin.width = img.width;
			ME.USE.origin.height = img.height;
			ME.USE.sourceImg = img;

		}
		//预览图片的居中显示
	ME.METHODS.setImgInMiddle = function (img) {
		var width = img.width,
			height = img.height,
			set = width > height ? {
				width: '90%',
				height: 'auto'
			} : {
				height: '90%',
				width: 'auto'
			};
		ME.DOM.$imgWrapper.css(set);
	}


	//提示面板的消息设置
	ME.METHODS.updatePrompt = function (msg) {
		ME.DOM.$prompt.text(msg);
	};
	ME.METHODS.onPrompt = function (state) {
		return state && ME.DOM.$prompt.fadeIn('slow') || ME.DOM.$prompt.fadeOut('slow');
	};
	//达夫设备
	ME.METHODS.duff = function (dataArr) {
		var iterations = (dataArr.length / 8) | 0,
			leftover = dataArr.length % 8,
			i = 0;
		return function (handle) {
			if (leftover > 0) {
				do {
					handle(dataArr[i++]);
				} while (--leftover > 0);
			}
			do {
				handle(dataArr[i++]);
				handle(dataArr[i++]);
				handle(dataArr[i++]);
				handle(dataArr[i++]);
				handle(dataArr[i++]);
				handle(dataArr[i++]);
				handle(dataArr[i++]);
				handle(dataArr[i++]);
			} while (--iterations > 0);
		}
	};
	//通过canvas序列化图片数据
	ME.METHODS.getImgData = (function () {
		ME.USE.canvas = document.createElement('canvas');
		var context = ME.USE.context = ME.USE.canvas.getContext('2d');
		return function (img) {
			var width = ME.USE.canvas.width = ME.USE.origin.width,
				height = ME.USE.canvas.height = ME.USE.origin.height,
				imgData = null;
			context.drawImage(img, 0, 0, width, height);
			imgData = context.getImageData(0, 0, width, height);
			return imgData;
		}
	})();
	
	//canvas渲染
	ME.METHODS.render = function (renderData) {
		var context = ME.USE.context,
			p0, p1, p2, fc;
		//duff设循环展开
		ME.METHODS.duff(renderData)(function (item) {
			p0 = item.p0;
			p1 = item.p1;
			p2 = item.p2;
			fc = item.fc;
			context.beginPath();
			context.moveTo(p0.x, p0.y);
			context.lineTo(p1.x, p1.y);
			context.lineTo(p2.x, p2.y);
			context.lineTo(p0.x, p0.y);
			context.fillStyle = fc;
			context.fill();
		});

	};
	//将处理后的图片显示
	ME.METHODS.drawImg = function () {
		var img = ME.DOM.$imgWrapper.get(0);
		img.src = ME.USE.canvas.toDataURL('image/png');
	};
	//上面是一些预先定义的方法
	/*----------------------------------------------------------------------*/
	//下面是正式处理程序
	//	设置默认处理图片,虽然是异步，但一开始就加载应该没什么问题
	ME.USE.defaultImg.src = ME.DOM.$imgWrapper.get(0).src;
	//	禁用下载按钮按钮
	ME.DOM.$downloadBtn.attr("disabled", true);
	ME.WOK = ME.METHODS.FactoryWorker('./script/canvasDataWorker.js');
	//	ME.WOK = ME.METHODS.FactoryWorker('./script/handleWorker.js');
	//文件输入框选择图片
	ME.DOM.$sourceInput.on('change', function (event) {
		if (!this.value) return;
		var src = ME.METHODS.getImgSrc(this.files[0]);
		ME.METHODS.loadImg(src, function (img) {
			ME.METHODS.setImg(img);
			ME.METHODS.setImgInMiddle(img);
		});
	});


	//或者拖拽文件进行选择
	ME.DOM.$sourceWrapper.on('drop', function (event) {
		event.preventDefault();
		event.stopPropagation();
		var source = event.originalEvent.dataTransfer.files[0],
			src = ME.METHODS.getImgSrc(source);
		ME.METHODS.loadImg(src, function (img) {
			ME.METHODS.setImg(img);
			ME.METHODS.setImgInMiddle(img);
		});
	});


	//点击执行
	ME.DOM.$runBtn.on('click', function (event) {
		if (!ME.USE.sourceImg) {
			ME.METHODS.setImg(ME.USE.defaultImg);
		}
		ME.DOM.$downloadBtn.attr("disabled", true).addClass('disable');
		ME.METHODS.updateDefault();
		ME.METHODS.onPrompt(true);
		ME.METHODS.updatePrompt('Start processing');
		ME.USE.beginTime = +new Date();
		ME.USE.imgData = ME.METHODS.getImgData(ME.USE.sourceImg);
		ME.WOK.emit('run', {
			set: ME.DEFAULT,
			imgData: ME.USE.imgData
		});
		ME.USE.imgData = null;
	});
	//点击下载
	ME.DOM.$downloadBtn.on('click', function (event) {
		var link = document.createElement('a');
		link.href = ME.DOM.$imgWrapper.prop('src');
		link.download = 'Triangulated';
		link.click();
	});

	ME.DOM.$resetBtn.on('click', function (event) {
		ME.METHODS.setImg(ME.USE.defaultImg);

	});



	//消息提示
	ME.WOK.on('msg', function (event, data) {
		ME.METHODS.updatePrompt(data.msg);
	});
	
	ME.WOK.on('ok', function (event, data) {
		ME.METHODS.updatePrompt('Start rendering');
		ME.DOM.$downloadBtn.attr("disabled", false).removeClass('disable');
		ME.METHODS.render(data.renderData);
		ME.METHODS.drawImg();
		ME.USE.endTime = +new Date();
		console.log('Time consumed：' + (ME.USE.endTime - ME.USE.beginTime) + 'ms');
		ME.METHODS.onPrompt(false);

	});
	ME.METHODS.setDeault();

});