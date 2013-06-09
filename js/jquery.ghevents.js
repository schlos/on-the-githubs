(function( $ ) {
 
  $.fn.ghevents = function( options ) {

    var settings = $.extend({
      color: "#556b2f",
    }, options );

    var makeHtmlUrl = function (url) {
      var result = url;

      result = result.replace(/\/users\//, '/');
      result = result.replace(/\/repos\//, '/');
      result = result.replace(/\/api\./, '/');
      result = result.replace(/\/commits\//, '/commit/');

      return result;
    };

    var download = function (repo) {
      var d = $.Deferred();

      var githubs = localStorage.getItem('githubs');
      var time    = localStorage.getItem('githubs_date');
      try {
        githubs = JSON.parse(githubs);
      } catch (err) {
      }

      var now = +new Date() / 1000;
      if (githubs && time && now - time < 3 * 60) {
        d.resolve(githubs);
        return d;
      }

      var url = 'https://api.github.com/' + repo + '/events?per_page=20&callback=?';
      $.getJSON(url, function(data, textStatus, jqXHR) {
        // github does not support the per_page parameter for events
        if (data.data.message) {
          throw Error('GitHub says: ' + data.data.message + ' for url: ' + url);
        }
        data.data = data.data.slice(0, 20);

        localStorage.setItem('githubs', JSON.stringify(data));
        localStorage.setItem('githubs_date', now);
        d.resolve(data);
      });

      return d;
    };

    return this.each(function() {
      var $obj  = $(this);
      var repos = $obj.data('repo');

      download(repos).done(function (data) {

      $obj.html('');

      var template = '<abbr class="timeago" title="${created}">${created}</abbr>';
      template += '<img src="${gravatarSrc}" class="gravatar" />';
      template += '<p><a target="_blank" href="${userUrl}" class="author">${username}</a> ';
      template += '<span>{{html action}}</span>';
      template += ' <a target="_blank" href="${repoUrl}">${repoName}</a>${branch}{{html commits}}</p>';
      template += '<div class="clearfix"></div>';

      for (var i = 0; i < data.data.length; i++) {
        var item = data.data[i];

        var gravatarSrc = item.actor.avatar_url + '&s=64';
        var username    = item.actor.login;
        var action      = '';
        var branch      = '';
        var commits     = '';

        // http://developer.github.com/v3/activity/events/types/
        var isClosed = false;

        switch (item.type) {
          case 'IssuesEvent':
            // console.log(item);
            isClosed = item.payload.issue.state === 'closed';
            action   = item.payload.action + ' ';
            action  += 'issue <a target="_blank" href="' + item.payload.issue.html_url + '">';

            if (isClosed) {
              action += '<s>';
            }
            action += item.payload.issue.title;
            if (isClosed) {
              action += '</s>';
            }

            action += '</a> on';
            break;
          case 'CommitCommentEvent':
            action  = 'commented "' + item.payload.comment.body + '" ';
            action += 'on a commit to <a target="_blank" href="' + item.payload.comment.html_url + '">';
            action += item.payload.comment.path + '</a> in';
            break;
          case 'IssueCommentEvent':
            isClosed = item.payload.issue.state === 'closed';

            action  = 'commented on <a target="_blank" href="' + item.payload.comment.html_url + '">';
            if (isClosed) {
              action += '<s>';
            }
            action += item.payload.issue.title;
            if (isClosed) {
              action += '</s>';
            }
            action += '</a> in';
            break;
          case 'PushEvent':
            // var commitString = item.payload.commits.length === 1 ? 'commit' : 'commits';

            if (!item.payload || !item.payload.commits || item.payload.commits.length === 0) {
              break;
            }
            var firstCommit = item.payload.commits[0].sha;
            var firstUrl    = makeHtmlUrl(item.payload.commits[0].url);
            var lastCommit  = '';
            var messages    = [];
            var msg         = '';
            for (var j in item.payload.commits) {
              lastCommit = item.payload.commits[j].sha;
              msg = item.payload.commits[j].message.substr(0, 50);
              if (msg.length > item.payload.commits[j].message.length) {
                msg += ' ...';
              }
              messages.push(msg);
            }
            var compareUrl  = firstUrl.replace('commit', 'compare').replace(firstCommit, firstCommit + '...' + lastCommit);
            var txtMessages = messages.join(' &mdash; ');

            action  = 'pushed ';
            if (item.payload.commits.length === 1) {
              action += '<a target="_blank" rel="tooltip" data-placement="right" title="' + txtMessages + '" href="' + firstUrl + '">';
              action += '1 commit';
              action += '</a>';
            } else {
              action += '<a target="_blank" rel="tooltip" data-placement="right" title="' + txtMessages + '" href="' + compareUrl + '">';
              action += item.payload.commits.length + ' ' + 'commits';
              action += '</a>';
            }
            action += ' to';

            // commits = '<ul class="commits">';
            // for (var j in item.payload.commits) {
            //   var commit = item.payload.commits[j];

            //   var sha = commit.sha.substr(0, 7);
            //   var msg = commit.message.substr(0, 50);
            //   if (msg.length !== commit.message.length) {
            //     msg += ' ...';
            //   }

            //   commits += '<li>';
            //   commits += '<a href="' + makeHtmlUrl(commit.url) + '">' + sha + '</a>';
            //   commits += ' ' + msg;
            //   commits += '</li>';
            // }

            // commits += '</ul>';
            // console.log(item.type, item);
            break;
          case 'ForkEvent':
            action = 'forked';
            break;
          case 'WatchEvent':
            action = 'is now watching';
            break;
          case 'PullRequestEvent':
            action  = item.payload.action + ' ';
            action += 'pull request <a target="_blank" href="' + item.payload.pull_request.html_url + '">';
            action += item.payload.pull_request.title;
            action += '</a> for';

            break;
          case 'CreateEvent':
            // @TODO: Not tested for ref_type != 'branch'
            action = 'created a new ' + item.payload.ref_type + ' in';
            branch = ': ' + item.payload.ref;
            break;
          default:
            console.log(item.type, item);
            break;
        }

        var entry = $.tmpl(template,
          {
            gravatarSrc: gravatarSrc,
            userUrl: makeHtmlUrl(item.actor.url),
            username: username,
            repoUrl: makeHtmlUrl(item.repo.url),
            repoName: item.repo.name,
            branch: branch,
            created: item.created_at,
            action: action,
            commits: commits
          }
        );
        $('<li/>').append(entry).appendTo($obj);
      }

      $('abbr.timeago').timeago();
      $('a[rel]').tooltip();
        
      });

      // Do something to each element here.
    });
  };
 
}( jQuery ));