# @ tars / deploy

TARS framework service packaging tool for packaging services to generate release packages suitable for TARS framework.

## Installation

`npm install -g @ tars / deploy`

> `Tars-deploy` is a CLI program, so you need to use the __- g__ parameter to install

## Usage

`tars-deploy name [options]`

* name is the "service name" of the service, if your service name is Server, then fill in "Server"
* [options] Optional configuration, see [Options] (# options) section

__When packaging: please change the current directory to the root directory of the service (that is, the directory where the service `package.json` is located) and execute this program

## options

Options:

> -h, --help output usage information  
> -V, --version output the version number  
> -f, --force Force to Build Package  
> -p --platform build deploy package for target platform

### -f, --force

Because the tool will package the current running environment (such as node executable binaries, recompile C / C ++ addon on the current architecture, etc.), please execute the packaging tool on the same environment (linux) as the target operating architecture.

Turn this switch on to bypass this restriction. But at the same time we strongly advise you not to do this!  

### -p, --platform
By default, the tool will build package running on the linux platform. If you want to specify other platforms, you can pass this parameter. Currently darwin / linux are supported.  

When you package on a non-linux system and do not specify a target platform, we provide a default linux platform nodejs  execution file  (currently linux x64 v12.17). If you want to package your own nodejs execution file, please run this tool in the environment of the target nodejs.
