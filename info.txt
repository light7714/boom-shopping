the deployment on heroku part of course..

added engines part in package.json, heroku will use that version of node when it installs that on that remote server.

Procfile added for heroku

--heroku doesnt offer compression on the fly, so make sure to use conpression package

--we wont be using our own ssl setup (cert and pvt key also), we will do that through heroku's managed server, so only make normal http server. So commented that part from code. (heroku uses its own ssl cert and key... but i thought its not free??)

--we have added node_modules in gitignore, as hosting providers install the dependencies on the server after deployment. .env also there in gitignore, as we'll set env variables thru heroku cli or dashboard.
server.cert, server.key also added to gitignore (log file removed from gitignore, it wasnt in vid as well..)

--passing env variables (called config vars in heroku) in heroku settings (website) (NODE_ENV is added by default)

--in mongodb atlas, we should ideally whitelist the ip of our deployed app. But rn, we dont have static IP, so whitelist all ips (0.0.0.0/0), already done earlier. For whitelisting see this: https://help.heroku.com/JS13Y78I/i-need-to-add-heroku-dynos-to-our-allowlist-what-are-ip-address-ranges-in-use-at-heroku

## it's extremely uncommon to perform a git pull from Heroku. Instead, you should use a git hosting (such as GitHub or BitBucket) to store your repository and only perform push to Heroku to deploy the application.
Only pushing readme changes to git, as im not sure if that will cause merge conflicts or not... see later https://devcenter.heroku.com/articles/git