# J!Party Game

This project is the crawler piece of the J!Party collection.

Out of the box, it crawls the [J! Archive website](http://www.j-archive.com/) and stores the clues and answers into a [SQLite](http://sqlite.org/) database. Subsequent runs of the crawler will update or add new entries, without duplicating existing data.

## Usage

[NodeJS and npm](https://nodejs.org/) are required to run the software.

First install its dependencies:

```shell
npm install
```

Then, to run the crawler:

```shell
npm start
```

## Configuration

The crawler can be configured with files in the [`config` folder](config). The `default.yaml` file contains the default settings.

More info can be found in the [node-config documentation](https://github.com/lorenwest/node-config/wiki/Configuration-Files).

## Development

Development uses [gulp](http://gulpjs.com/) to run tests and lint the code:

```shell
gulp
```

In lieu of a formal styleguide, take care to maintain the existing coding style.

## Related

* J!Party Bundle
* J!Party Device
* J!Party Game

## Legal

This software is copyright 2015 Eric Heikes and licensed under the [Apache License, Version 2.0](LICENSE.txt). It is not affiliated with, sponsored by, or operated by the J! Archive.

The Jeopardy! game show and all elements thereof, including but not limited to copyright and trademark thereto, are the property of Jeopardy Productions, Inc. and are protected under law. This software is not affiliated with, sponsored by, or operated by Jeopardy Productions, Inc.

## Thanks

Credit goes to [J! Archive](http://j-archive.com/) for their fantastic website.
