'use strict';

if (!module.parent) {
  // Set default node environment to development
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';

  var mongoose = require('mongoose');
  var config = require('../config/environment');
  var args = process.argv.slice(2);

  // Connect to database
  var db = mongoose.connect(config.mongo.uri, config.mongo.options);
}
var Commit = require('../api/commit/commit.model');
var Project = require('../api/project/project.model');

var Octokat = require('octokat');

var Promise = require("bluebird");

mongoose.Promise = require('bluebird');
/*
 The github token currently needs to be defined in development.js env.
 Since, this is a worker that is currently run individually, it does not have app.js loaded beforehand.
 Meaning, magic env stuff isn't automagically setup.
 @TODO: bring back the magic
 */
var gtoken = config.GITHUB_WORKER_TOKEN;
if(gtoken == "YOUR_KEY") {
  console.error('ERROR: PLEASE SET YOUR GITHUB AUTH IN DEVELOPMENT.JS TOKEN BEFORE PROCEEDING');
  throw new Error('ERROR: PLEASE SET YOUR GITHUB AUTH IN DEVELOPMENT.JS TOKEN BEFORE PROCEEDING');
}
// setup & initilize our github API library
var octo = new Octokat({
  token: gtoken
});

/*
 @TODO: add support for filtering commits by date/author/etc..
 ex: only get commits newer than date x, or only get commits older than date y
 */
function fetchCommitsFromProject (owner, repository, config) {
  return fetchAll(octo.repos(owner, repository).commits.fetch, config);
}
function fetchAll(fn, args) {
  let acc = [];
  if (!args) {
    args = {per_page: 100};
  }
  let p = new Promise((resolve, reject) => {
    fn(args).then((val) => {
      acc = acc.concat(val);
      if (val.nextPage) {
        fetchAll(val.nextPage).then((val2) => {
          acc = acc.concat(val2);
          resolve(acc);
        }, reject);
      } else {
        resolve(acc);
      }
    }, reject);
  });
  return p;
}
  // var fn = octo.repos(owner,repository).commits.fetch;
  //
  // let acc = []; // Accumulated results
  // let p = new Promise((resolve, reject) => {
  //   fn(config).then((val) => {
  //     acc = acc.concat(val);
  //     if (val.nextPage) {
  //       return fetchAll(val.nextPage).then((val2) => {
  //         acc = acc.concat(val2);
  //         resolve(acc);
  //       }, reject);
  //     } else {
  //       resolve(acc);
  //     }
  //   }, reject);
  // });
  // console.log("Fetched commits for project:::", repository);
  // return p;
// }

var saveCommit = function (commitData, project) {
  var newCommit = new Commit(commitData);
  /*
   establish the ownership relationship; i.e. what project does this commit belong to?
   @TODO: setup the inverse relationship(?); i.e. what commits does the project own?
   */
  newCommit.project = project;
  /*
   manually extract/configure the data to match our Commit schema.
   */
  newCommit.message = commitData.commit.message;
  newCommit.date = commitData.commit.author.date;
  newCommit.commentCount = commitData.commit.comment_count;
  // Save the new commit model to the db. This is an async operation, so it will be turned into a promise.
  return newCommit.save();
};
/*
 @promiseObject: JS object containing 2 fields.
 commits: promise array of fetched commits from github
 project: instance of project model that we are fetching the commits for.
 */
var saveCommits = function (promiseObject) {
  // extract the data from the promiseObject
  var commits = promiseObject.commits;
  var project = promiseObject.project;
  // array of Commit.save() operations; to be turned into an array of Promises.
  var commitPromises = [];
  commits.forEach(function(commit) {
    commitPromises.push(saveCommit(commit, project));
  });
  // return an array of promises, where each promise is a promise to save the commit model to the DB.
  return Promise.all(commitPromises);
};

/**
 *
 * @param project: instance of Project model
 * @param config:
 */
var fetchCommits = function (project, config) {
  // extract the github username & github repository name to fetch the commits from.
  var owner = project.githubUsername;
  var repository = project.githubProjectName;

  // Config is an optional arguement, so if it isn't pased init it ourselves
  config = config || {};

  // always set the results per page limit to the maximum, 100, to reduce github API calls
  config["per_page"] = 100;

  /*
   Needed to pass through project model; to saveCommits; but javascript.
   So instead I just tacked it onto an object.
   Promise.props is essentially the same as using Promise.all([]),
   Except it returns an object with arbitrary fields that can be a promise or arbitrary data.
   with an added variable, @project.
   Probably a better way to do this, but I currently can't think of any because javascript.
   */

  return Promise.props({
    commits: fetchCommitsFromProject(owner, repository, config),
    project: project,
  });
};

/*
 For now just a hard coded example/P.O.C using the github repo rcos/observatory3
 Planning to refactor this "soon(tm)"
 */
if (!module.parent) {
  if (args.length == 0) {

    Project.findOne({githubUsername: 'rcos', githubProjectName: 'observatory3'}, function(err, project) {
      //@TODO: more robust error handling & feedback
      if(err) {
        console.error('Error finding project!');
        throw new Error('Error finding project!', err);
      }
      /*
       .then may not be needed? May just be able to do it all in this function?
       Probably un-needed, but I don't even anymore. Javascript is just too mystical...
       */
    }).then(function(project) {
      /*
       flow:
       1. fetch commits from github for @project
       2. save fetched commits to db
       3. disconnect from DB
       */
      fetchCommits(project).then(saveCommits).then(function() {
        console.log("Processed commits for project::: ", project.githubProjectName);
      }).then(function () {
        db.disconnect();
        console.log("Done fetching & saving commits!\n Check the commits collection in your database!");
      });

    });
  }
}