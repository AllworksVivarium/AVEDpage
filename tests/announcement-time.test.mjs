import test from 'node:test';
import assert from 'node:assert/strict';
import {announcementPublicationTime as parse} from '../server-announcement-time.mjs';
test('announcement publication accepts arbitrary valid dates with explicit company timezone',()=>{
 assert.equal(parse('2024-02-29T00:00'),'2024-02-28T16:00:00.000Z');
 assert.equal(parse('2030-11-06T18:14:12'),'2030-11-06T10:14:12.000Z');
 assert.equal(parse('2000-01-01T10:00:00Z'),'2000-01-01T10:00:00.000Z');
 assert.equal(parse('2026-11-06T18:14:12+08:00'),'2026-11-06T10:14:12.000Z');
 assert.equal(parse('2026-11-06T01:00:00-07:00'),'2026-11-06T08:00:00.000Z');
 assert.equal(parse(undefined),undefined);assert.equal(parse(''),undefined);
 for(const bad of ['2025-02-29T12:00','2026-04-31T00:00','2026-01-01T24:00','2026-01-01T12:60','2026-01-01T12:00:60','2026-01-01T12:00+14:01','2026-13-01T00:00','not a date',null,123])assert.throws(()=>parse(bad));
});
