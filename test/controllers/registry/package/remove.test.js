'use strict';

var should = require('should');
var request = require('supertest');
var mm = require('mm');
var app = require('../../../../servers/registry');
var utils = require('../../../utils');
var config = require('../../../../config');
var packageService = require('../../../../services/package');
var nfs = require('../../../../common/nfs');

describe('test/controllers/registry/package/remove.test.js', function () {
  afterEach(mm.restore);

  before(function (done) {
    var pkg = utils.getPackage('@cnpmtest/testmodule-remove-1', '1.0.0', utils.otherUser);
    request(app)
    .put('/' + pkg.name)
    .set('authorization', utils.otherUserAuth)
    .send(pkg)
    .expect(201, done);
  });

  it('should delete 401 when no auth', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1/-rev/1')
    .expect({
      error: '[unauthorized] Login first',
      reason: '[unauthorized] Login first',
    })
    .expect(401, done);
  });

  it('should 404 when package not exists', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1-not-exists/-rev/1')
    .set('authorization', utils.adminAuth)
    .expect({
      error: '[not_found] document not found',
      reason: '[not_found] document not found',
    })
    .expect(404, done);
  });

  it('should delete 403 when user is not admin', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1/-rev/1')
    .set('authorization', utils.otherUserAuth)
    .expect({
      error: '[no_perms] Only administrators can unpublish module',
      reason: '[no_perms] Only administrators can unpublish module',
    })
    .expect(403, done);
  });

  it('should remove all versions ok', function (done) {
    request(app)
    .del('/@cnpmtest/testmodule-remove-1/-rev/1')
    .set('authorization', utils.adminAuth)
    .expect(200, function (err) {
      should.not.exist(err);
      request(app)
      .get('/@cnpmtest/testmodule-remove-1')
      .expect(404, done);
    });
  });

  it('should not remove nfs', function (done) {
    let called = false;
    mm(config, 'unpublishRemoveTarball', false);
    mm(nfs, 'remove', function* () {
      called = true;
    });

    var pkg = utils.getPackage('@cnpmtest/testmodule-remove-2', '3.0.0', utils.otherUser);
    request(app)
      .put('/' + pkg.name)
      .set('authorization', utils.otherUserAuth)
      .send(pkg)
      .expect(201, function() {
        request(app)
          .del('/@cnpmtest/testmodule-remove-2/-rev/1')
          .set('authorization', utils.adminAuth)
          .expect(200, function (err) {
            called.should.equal(false);
            should.not.exist(err);
            request(app)
              .get('/@cnpmtest/testmodule-remove-2')
              .expect(404, done);
          });
      });
  });

  describe('mock error', function () {
    beforeEach(function (done) {
      var pkg = utils.getPackage('@cnpmtest/testmodule-remove-mock-1', '2.0.0', utils.admin);
      request(app)
      .put('/' + pkg.name)
      .set('authorization', utils.adminAuth)
      .send(pkg)
      .expect(201, done);
    });

    it('should mock key not exists', function (done) {
      var listModulesByName = packageService.listModulesByName;
      mm(packageService, 'listModulesByName', function* (name) {
        var mods = yield listModulesByName.call(packageService, name);
        mods.forEach(function (mod) {
          delete mod.package.dist.key;
        });
        return mods;
      });
      request(app)
      .del('/@cnpmtest/testmodule-remove-mock-1/-rev/1')
      .set('authorization', utils.adminAuth)
      .expect(200, function (err) {
        should.not.exist(err);
        request(app)
        .get('/@cnpmtest/testmodule-remove-mock-1')
        .expect(404, done);
      });
    });

    it('should mock nfs remove error', function (done) {
      mm(nfs, 'remove', function* () {
        throw new Error('mock nfs remove error');
      });
      request(app)
      .del('/@cnpmtest/testmodule-remove-mock-1/-rev/1')
      .set('authorization', utils.adminAuth)
      .expect(200, function (err) {
        should.not.exist(err);
        request(app)
        .get('/@cnpmtest/testmodule-remove-mock-1')
        .expect(404, done);
      });
    });
  });
});
