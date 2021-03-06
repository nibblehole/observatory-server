'use strict';

(function() {

/**
 * The Util service is for thin, globally reusable, utility functions
 */
function UtilService($window) {
  var Util = {
    /**
     * Return a callback or noop function
     *
     * @param  {Function|*} cb - a 'potential' function
     * @return {Function}
     */
    safeCb(cb) {
      return (angular.isFunction(cb)) ? cb : angular.noop;
    },

    /**
     * Parse a given url with the use of an anchor element
     *
     * @param  {String} url - the url to parse
     * @return {Object}     - the parsed url, anchor element
     */
    urlParse(url) {
      var a = document.createElement('a');
      a.href = url;

      // Special treatment for IE, see http://stackoverflow.com/a/13405933 for details
      if (a.host === '') {
        a.href = a.href;
      }

      return a;
    },

    /**
     * Test whether or not a given url is same origin
     *
     * @param  {String}           url       - url to test
     * @param  {String|String[]}  [origins] - additional origins to test against
     * @return {Boolean}                    - true if url is same origin
     */
    isSameOrigin(url, origins) {
      url = Util.urlParse(url);
      origins = (origins && [].concat(origins)) || [];
      origins = origins.map(Util.urlParse);
      origins.push($window.location);
      origins = origins.filter(function(o) {
        return url.hostname === o.hostname &&
          url.port === o.port &&
          url.protocol === o.protocol;
      });
      return (origins.length >= 1);
    },

    parseAttendance(u){
      u.full={normal:0, bonus:0};
      u.small={normal:0, bonus:0};
      u.unverified = 0;
      for (var b = 0; b < u.attendance.length; b++){
          var submission = u.attendance[b];
          if (!submission.verified){
              u.unverified +=1;
          }
          else if (submission.smallgroup && !submission.bonusDay){
              u.small.normal +=1;
          }
          else if (submission.smallgroup){
              u.small.bonus +=1;
          }
          else if(submission.bonusDay){
              u.full.bonus +=1;
          }
          else{
              u.full.normal +=1;
          }
      }
    },
    parseAttendanceFromAll(u,attendance){
        u.full={normal:0, bonus:0};
        u.small={normal:0, bonus:0};
        u.unverified = 0;
        for (var b = 0; b < attendance.length; b++){
          if (attendance[b].user === u._id){
            var submission = attendance[b];
            if (!submission.verified){
                u.unverified +=1;
            }
            else if (submission.smallgroup && !submission.bonusDay){
                u.small.normal +=1;
            }
            else if (submission.smallgroup){
                u.small.bonus +=1;
            }
            else if(submission.bonusDay){
                u.full.bonus +=1;
            }
            else{
                u.full.normal +=1;
            }
          }
        }
      },
  };

  return Util;
}

angular.module('observatory3App.util')
  .factory('Util', UtilService);

})();
