#!/usr/bin/env node

/**
 * Tencent is pleased to support the open source community by making Tars available.
 *
 * Copyright (C) 2016THL A29 Limited, a Tencent company. All rights reserved.
 *
 * Licensed under the BSD 3-Clause License (the "License"); you may not use this file except 
 * in compliance with the License. You may obtain a copy of the License at
 *
 * https://opensource.org/licenses/BSD-3-Clause
 *
 * Unless required by applicable law or agreed to in writing, software distributed 
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
 * CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */

'use strict'

var os = require('os');
var fs = require('fs');
var path = require('path');
var events = require('events');
var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;
var zlib = require('zlib');

var async = require('async');
var fse = require('fs-extra');
var fstream = require('fstream');
var tar = require('tar');
const md5 = require('md5');

module.exports = exports = new events();

var tmpName = '';

var config = exports.config = {
	exclude : ['.svn', '.git', '_svn', '_git', '.tgz', '_tmp_dir', '.idea', '.DS_Store'],
	level : 6,
	memLevel : 6,
	maxBuffer : 500 * 1024
};

var npmName = '';
var testIfExistsNpm = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'tnpm', ['-v'],{stdio: 'inherit'});
if (testIfExistsNpm.status !== 0) {
	npmName = process.platform === 'win32' ? 'npm.cmd' : 'npm';
} else {
	npmName = process.platform === 'win32' ? 'tnpm.cmd' : 'tnpm';
}
console.log('run with ' + npmName);

var isNeedToInstallNodeModules = true;
var isNeedToInstallAgent = true;

var execNPM = function(command, cwd, options, cb) {
	fs.exists(path.join(cwd, 'package.json'), function(exists) {
		var npm;

		command = command.trim().split(' ');
		if (!exists && command.length <= 1) {
			return cb();
		}
		npm = spawn(npmName, command, {cwd : cwd,  stdio: 'inherit'});

		npm.on('exit', function(code) {
			var err;

			if (code !== 0) {
				err = new Error('npm return code: "' + code + '"');
			}

			fs.unlink(path.join(cwd, 'npm-debug.log'), function() {
				cb(err);
			});
		});
		
	});
};

// 初始化目录结构
var mkdir = function(name, dir, cb) {
	exports.emit('progress:start', 'Creating directory structure');

	fs.stat(dir, function(err, stat) {
		if (err || !stat.isDirectory()) {
			cb(new Error('Not a directory'));
			return;
		}

		fs.mkdir(path.join(dir, tmpName), function(err) {
			fs.readdir(dir, function(err, files) {
				if (err) {
					cb(err);
					return;
				}

				async.mapSeries([
					path.join(dir, tmpName, name),
					path.join(dir, tmpName, name, name),
					path.join(dir, tmpName, name, name, 'src'),
					path.join(dir, tmpName, name, name, 'tars_nodejs'),
					path.join(dir, tmpName, name, name, 'tars_nodejs', 'node-agent'),
					path.join(dir, tmpName, name, name, 'tars_nodejs', 'node-agent', 'node_modules')
				], fs.mkdir.bind(fs), function(err) {

					async.map(files.filter(function(file) {
						return file !== tmpName;
					}).map(function(file) {
						return [path.join(dir, file), path.join(dir, tmpName, name, name, 'src', file)];
					}), function(item, cb) {
						fse.copy(item[0], item[1], cb);
					}, function(err) {
						if (err) {
							cb(err);
						} else {
							exports.emit('progress:end', 'Created directory');
							cb();
						}
					});
				
				});
			});
		});
	});
};

// 拷贝 node 可执行文件
var cp = function(name, dir, cb, options) {
	exports.emit('progress:start', 'Copying node exec file');
	var localPlatform = os.platform(), targetPlatform = options.platform
	var nodePath = localPlatform == targetPlatform ? process.execPath : path.join(__dirname, 'deps', targetPlatform, 'node')
	fse.copy(nodePath, path.join(dir, tmpName, name, name, 'tars_nodejs', 'node'), function(err) {
		if (err) {
			cb(err);
		} else {
			exports.emit('progress:end', 'Copied file');
			cb();
		}
	});
};

var installNodeAgent = function (name, dir, cb) {
	exports.emit('progress:start', 'Installing node-agent');
	var cwd = path.join(dir, tmpName, name, name, 'tars_nodejs', 'node-agent');

	if (isNeedToInstallAgent) {
		execNPM('install --global-style --no-save --loglevel error @tars/node-agent', cwd, null, function (err, stdin, stderr) {
			exports.emit('progress:end', 'installNodeAgent finish');
			cb(err, stdin, stderr)
		});
	} else {
		exports.emit('progress:end', 'installNodeAgent finish, no need to install');
		cb();
	}
}

// 安装 node-agent
var install = function(name, dir, cb) {
	exports.emit('progress:start', 'Copying node-agent');

	var cwd = path.join(dir, tmpName, name, name, 'tars_nodejs', 'node-agent');

	fs.exists(path.join(cwd, 'node_modules', '@tars', 'node-agent'), function(exists) {
		if (!exists) {
			exports.emit('progress:end', 'Installed node-agent');
			cb();
			return;
		}

		fs.rename(path.join(cwd, 'node_modules', '@tars', 'node-agent'), cwd + '2', function(err) {
			if (err) {
				cb(err);
				return;
			}
			fse.remove(cwd, function(err) {
				if (err) {
					cb(err);
					return;
				}
				fs.rename(cwd + '2', cwd, function(err) {
					if (err) {
						cb(err);
					} else {
						exports.emit('progress:end', 'Installed node-agent');
						cb(null);
					}
				});
			});
		});
	});
};


var checkIsNeedToInstallAgent = function(name, dir, cb) {
	exports.emit('progress:start', 'checkIsNeedToInstallAgent');
	var cwd = path.join(dir, tmpName, name, name, 'tars_nodejs', 'node-agent');

	fs.exists(cwd, function (exists) {
		isNeedToInstallAgent = !exists;
		exports.emit('progress:end', 'isNeedToInstallAgent=' + isNeedToInstallAgent);
		cb();
	})
}

var checkIsNeedToInstallNodeModules = function(name, dir, cb) {
	exports.emit('progress:start', 'checkIsNeedToInstallNodeModules');

	var cwd = path.join(dir, tmpName, name, name, 'src');
	fs.readFile(path.join(cwd, 'package.json'), function(err, buf) {
		if (err) {
			isNeedToInstallNodeModules = true;
			exports.emit('progress:end', 'isNeedToInstallNodeModules=' + isNeedToInstallNodeModules);
			cb();
			return;
		}
		fs.readFile(path.join(dir, 'package.json'), function (err, buf2) {
			if (err) {
				isNeedToInstallNodeModules = true;
			} else {
				if (md5(buf) === md5(buf2)) {
					isNeedToInstallNodeModules = false;
				} else {
					isNeedToInstallNodeModules = true;
				}
			}
			exports.emit('progress:end', 'isNeedToInstallNodeModules=' + isNeedToInstallNodeModules);
			cb();
		});
	});
}


// 安装 src 中的依赖项
var init = function(name, dir, cb) {
	exports.emit('progress:start', 'Installing dependency');

	if (!isNeedToInstallNodeModules) {
		exports.emit('progress:end', 'Installed dependency no need');
		cb();
		return;
	}

	var cwd = path.join(dir, tmpName, name, name, 'src');
	
	fs.exists(path.join(cwd, 'package.json'), function(exists) {
		if (!exists) {
			exports.emit('progress:end', 'Not found package.json');
			return cb();
		}

		execNPM('install --production', cwd, null, function(err, stdout, stderr) {
			if (!err) {
				exports.emit('progress:end', 'Installed dependency');
			}

			cb(err, stdout, stderr);
		});
	});
};

// 重新编译
var rebuild = function(name, dir, cb) {
	exports.emit('progress:start', 'Building C/C++ modules');

	if (!isNeedToInstallNodeModules) {
		exports.emit('progress:end', 'No Need to build C/C++ modules');
		cb();
		return;
	}

	var cwd = path.join(dir, tmpName, name, name, 'src');
	execNPM('rebuild', cwd, null, function(err, stdout, stderr) {
		if (err) {
			cb(err, stdout, stderr);
			return;
		}

		fs.exists(path.join(cwd, 'binding.gyp'), function(exists) {
			var gyp;

			if (!exists) {
				exports.emit('progress:end', 'Not found C/C++ modules');
				return cb();
			}

			if (os.platform() !== 'linux') {
				cb(new Error('Compile C/C++ modules must be under linux system'));
				return;
			}

			gyp = spawn('node-gyp', ['rebuild'], {cwd : cwd,  stdio: 'inherit'});

			gyp.stdout.pipe(process.stdout);
			gyp.stderr.pipe(process.stderr);

			gyp.on('exit', function(code) {
				var err;

				if (code !== 0) {
					err = new Error('node-gyp return code: "' + code + '"');
				} else {
					exports.emit('progress:end', 'Built C/C++ modules');
				}

				cb(err);
			});
		});
	});
};

// 生成tar.gz, tgz包
var pack = function(name, dir, cb) {
	exports.emit('progress:start', 'Making deploy package');

	tar.c({
		gzip: {
			level: config.level,
			memLevel: config.memLevel
		},
		filter: function (_path, stat) {
			return !config.exclude.some(name => {
				if (_path.indexOf(name) !== -1) {
					return true;
				}
				return false;
			});
		},
		cwd: path.join(dir, tmpName)
	}, [
		'./'
	]).pipe(
		fs.createWriteStream(path.join(dir, name + '.tgz'))
	).on('close', function () {
		exports.emit('progress:end', 'Made deploy package');
		cb();
	})

	return;
};

// 删除临时文件
var clean = function(name, dir, cb) {
	exports.emit('progress:start', 'Cleaning temp files');
	fse.remove(path.join(dir, tmpName), function(err) {
		if (!err) {
			exports.emit('progress:end', 'Cleaned temp files');
		}

		if (typeof cb === 'function') {
			cb(err);
		}
	});
};

var STEP_SERIES = [checkIsNeedToInstallAgent, checkIsNeedToInstallNodeModules, mkdir, cp, installNodeAgent, install, init, rebuild, pack];

exports.STEP_COUNT = STEP_SERIES.length;

exports.make = function(name, dir, options) {
	options = options || {}
	tmpName = '_build'
	var wrapper = function(fn) {
		return function(callback) {
			fn(name, dir, callback, options);
		};
	};

	if (options.isClean) {
		STEP_SERIES.unshift(clean);
		exports.STEP_COUNT = STEP_SERIES.length;
	}

	async.series(STEP_SERIES.map(function(fn) {
		return wrapper(fn);
	}), function(err) {
		if (err) {
			exports.emit('error', err);
			clean(name, dir);
		} else {
			exports.emit('done', path.join(dir, name + '.tgz'));
		}
	});
};