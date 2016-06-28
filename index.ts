/**
 * Created by scott on 6/15/16.
 */

import * as request from 'request';
import assign = require('object-assign');

// forked from https://github.com/helix-collective/node-sumologic

// Log to sumo logic directly
function safeToString(obj: any) {
    try {
        if (typeof obj === 'object') {
            return JSON.stringify(obj);
        }
        return obj;
    } catch (err) {
        try {
            return JSON.stringify(String(obj));
        } catch (err) {
            return JSON.stringify('error serializing log line');
        }
    }
}

export function initLogging(url: string, env: string, contextFetcher: () => Object) {
    if (url) {
        const logger = new SumoLogger(url);
        console.log('replacing console.log (+context +sumo)');
        configLogger(logger, contextFetcher);
        console.log('replaced console log fns')
    } else {
        console.log('replacing console.log (+context)');
        configLogger(null, contextFetcher);
        console.log('replaced console log fns');
        return;
    }
}

enum Level {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    LOG = 3,
    WARN = 4,
    ERROR = 5
}

function configLogger(logger: SumoLogger | null, contextFn: () => Object) {
    replaceLogger(
        (level, args) => {
            let context = {
                _t: new Date().toISOString(),
                _l: Level[level]
            };
            const extraContext = contextFn();
            context = assign(context, extraContext);

            if (args.length === 0) {
                return args;
            }
            if (args.length === 1) {
                const arg = args[0];
                if (arg instanceof Error) {
                    return [assign(arg, context)]
                } else if (typeof arg === 'object') {
                    return [JSON.stringify(assign(context, arg))]
                }
                return [JSON.stringify(assign(context, { msg: arg }))];
            } else {
                return [context].concat(args);
            }
        },
        (level, args) => {
            if (args.length === 0) {
                return;
            }
            if (!logger) {
                return;
            }
            logger.append(level, args);
        }
    )
}

function replaceLogger(before: (level: Level, args: any[]) => any[], after: (level: Level, args: any[]) => void) {
    const original: { [key: string]: () => void } = {
        trace: console.trace,
        debug: console.debug,
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    function makeLogger(lvl: Level) {
        return function() {
            let inArgs = Array.prototype.slice.call(arguments);
            let args = before(lvl, inArgs);
            original[Level[lvl].toLowerCase()].apply(null, args);
            after(lvl, args);
        }
    }
    console.trace = makeLogger(Level.TRACE);
    console.debug = makeLogger(Level.DEBUG);
    console.log = makeLogger(Level.INFO);
    console.info = makeLogger(Level.INFO);
    console.warn = makeLogger(Level.WARN);
    console.error = makeLogger(Level.ERROR);
}

class SumoLogger {
    url: string;
    syncInterval = 1000;
    numBeingSent = 0;
    maxLines = 100;

    // Cache of entries we are yet to sync
    unsynced: string[] = [];

    constructor(url: string) {
        this.url = url;
    }

    append(lvl: Level, args: any[]) {
        const stringifyArgs = args.map(safeToString);

        // In the common case of a single log value, pull it out. It's easier in sumo
        // logic to traverse known object graphs without arrays, especially at the
        // top level
        let data = '';
        if (stringifyArgs.length === 1) {
            data = stringifyArgs[0];
        } else {
            data = stringifyArgs.join('\t');
        }

        this.unsynced.push(data);
    }


    // explicit decision to *not* use debounce/throttle so the syncing code is
    // explicit, and it's possible for a human to prove it's correctness
    syncer = setInterval(() => {
        // Only one active sync at any given interval
        if (this.numBeingSent > 0) {
            return;
        }

        // Short-circuit if there is nothing to send
        if (this.unsynced.length === 0) {
            return;
        }

        const logLines = this.unsynced.slice(0, this.maxLines);
        const body = logLines.join('\n');
        this.numBeingSent = logLines.length;

        // Sync logs to sumo-logic, and clear all synced data. On failure we'll retry the sync
        request({
            method: 'POST',
            url: this.url,
            body: body,
        }, (error: Error, response: any) => {
            const failed = !!error ||
                response.statusCode < 200 ||
                response.statusCode >= 400;

            if (!failed) {
                this.unsynced.splice(0, this.numBeingSent);
            }

            this.numBeingSent = 0;
        })
    }, this.syncInterval);
}
