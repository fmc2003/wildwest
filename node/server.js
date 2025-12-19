//server.js
//main server file for wildwest app
//sets up express, session management routing and socket.io chat
/*features 
  - user registration
  - login
  - comments 
  - profile management 
  - password reset (not functional)
  - and chat*/

//imports
require('dotenv').config();//node mailer env vars
const session = require('express-session');
const path = require('path');
const express = require('express');
const { engine } = require('express-handlebars');
const db = require('./modules/db');
const argon2 = require('argon2');
const validate = require('./modules/validate');
const mailer = require('./modules/mailer');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const initChat = require('./modules/chat');

//app setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);


const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

//socket.io session middleware
const sessionMiddleware = session({
  secret: 'not-a-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
});

app.use(sessionMiddleware);
initChat(io, sessionMiddleware);

//session call
//insecure
app.use(session({
  secret: 'not-a-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

//handlebars setup
app.engine('hbs', engine({
  extname: '.hbs',
  partialsDir: path.join(__dirname, 'public/views/partials'),
  helpers: {
    formatDate: (epoch) => {
      if (!epoch) return '';
      return new Date(epoch * 1000).toLocaleString();
    },
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    gt: (a, b) => a > b,
    lt: (a, b) => a < b
  }
}));



app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public/views')); 

app.use(express.static(path.join(__dirname, 'public')));

//returns current user
function currentUser(req) {
  return req.session.user || null;
}

//login
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login Page' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const now = Math.floor(Date.now() / 1000); //current time

  //fetch user
  const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);

  //check if user exists and if locked
  if (user && user.locked_until && user.locked_until > now) {
    return res.render('login', { error: `Account locked. Try again later.` });
  }

  let loginSuccess = false;

  if (user && await argon2.verify(user.password_hash, password)) {
    loginSuccess = true;
    
    //clear locked_until if login is successful
    if (user.locked_until && user.locked_until > now) {
      await db.run(`UPDATE users SET locked_until = 0 WHERE id = ?`, [user.id]);
    }

    //set session
    req.session.user = {
      id: user.id,
      username: user.username,
      display_name: user.display_name
    };

    res.redirect('/comments');
  }

  //log the attempt
  await db.run(
    `INSERT INTO login_attempts (username, ip_address, timestamp, success)
     VALUES (?, ?, ?, ?)`,
    [username, req.ip, now, loginSuccess ? 1 : 0]
  );

  //handle failed login
  if (!loginSuccess) {
    if (user) {
      //count failed attempts in last 15 minutes
      const row = await db.get(
        `SELECT COUNT(*) AS count
         FROM login_attempts
         WHERE username = ? AND success = 0 AND timestamp > ?`,
        [username, now - 15 * 60]
      );

      if (row.count >= 5) {
        //lock account for 15 minutes
        await db.run(
          `UPDATE users SET locked_until = ? WHERE id = ?`,
          [now + 15 * 60, user.id]
        );
      }
    }

    return res.render('login', { error: 'Invalid credentials' });
  }
});



//logout
app.post('/logout', (req, res) => {
  //delete session on logout
  req.session.destroy(() => res.redirect('/'));
});

//register page
app.get('/register', (req, res) => {
  res.render('register', { title: 'Register Page' });
});

//register
app.post('/register', async (req, res) => {
  const { username, password, email, display_name } = req.body;

  //validate inputs
  if (!validate.required(username) ||
      !validate.required(password) ||
      !validate.required(email) ||
      !validate.required(display_name)) {
    return res.render('register', { error: 'All fields are required' });
  }

  //checks for display name, email, password validity
  if (!validate.displayName(username, display_name)) {
    return res.render('register', { error: 'Display name must differ from username' });
  }

  if (!validate.email(email)) {
    return res.render('register', { error: 'Invalid email address' });
  }

  if (!validate.strongPassword(password)) {
    return res.render('register', { error: 'Password is too weak' });
  }

  //hash password and insert into database
  const hash = await argon2.hash(password);
  try {
    await db.run(
      `INSERT INTO users (username, password_hash, email, display_name)
       VALUES (?, ?, ?, ?)`,
      [username, hash, email, display_name]
    );
    res.redirect('/login');
  } catch (err) {
    console.error('Registration failed:', err);
    res.render('register', { error: 'Username or email already exists' });
  }
});




//home
app.get('/', (req, res) => {
  res.render('home', { title: 'Home Page' });
});

//comments

//new comment
app.get('/new-comment', (req, res) => {
  if (!currentUser(req))
    return res.redirect('/login');
  //comments are all titled new comment
  res.render('new_comment', { title: 'New Comment' });
});

//comment posting
app.post('/comment', async (req, res) => { 
  if (!currentUser(req))
    return res.redirect('/login');

  const text = (req.body.text || '').trim(); 
  if (!text) { 
    return res.render('new_comment', {
      title: 'New Comment', error: 'Comment cannot be empty' 
    }); 
  }

  const timestamp = Math.floor(Date.now() / 1000);

  //insert comment into database
  await db.run(
    `INSERT INTO comments (user_id, text, created_at)
     VALUES (?, ?, ?)`,
    [req.session.user.id, text, timestamp]
  );

  res.redirect('/comments'); 
});

//comments page with pagination
app.get('/comments', async (req, res) => {
  const COMMENTS_PER_PAGE = 20;
  const page = parseInt(req.query.page) || 1;

  //total comment count
  const totalRow = await db.get(`SELECT COUNT(*) AS count FROM comments`);
  const totalComments = totalRow.count;

  //calculate offset
  const offset = (page - 1) * COMMENTS_PER_PAGE;

  //fetch paginated comments
  const comments = await db.all(`
    SELECT comments.text, comments.created_at, comments.user_id, users.display_name, users.profile_color
    FROM comments
    JOIN users ON comments.user_id = users.id
    ORDER BY comments.id DESC
    LIMIT ? OFFSET ?
  `, [COMMENTS_PER_PAGE, offset]);
  



  const totalPages = Math.ceil(totalComments / COMMENTS_PER_PAGE);
  //render comments page
  res.render('comments', {
    title: 'Comment Page',
    comments,
    user: req.session.user,
    pagination: {
      current: page,
      totalPages
    }
  });
});


//profile
app.get('/profile', async (req, res) => {
  if (!currentUser(req)) return res.redirect('/login');

  //fetch user info
  const user = await db.get(
    `SELECT username, email, display_name, profile_color
     FROM users WHERE id = ?`,
    [req.session.user.id]
  );

  //render profile page
  res.render('profile', {
    title: 'Profile',
    user
  });
});

//profile update password unaccessible due to email issues
app.post('/profile/update-password', async (req, res) => {
  if (!currentUser(req)) return res.redirect('/login');

  //update password
  const { current_password, new_password } = req.body;
  const user = await db.get(`SELECT password_hash FROM users WHERE id = ?`, [req.session.user.id]);

  //verify current password
  if (!await argon2.verify(user.password_hash, current_password)) {
    return res.render('profile', { error: 'Current password is incorrect', user: req.session.user });
  }

  //validate new password strength
  if (!validate.strongPassword(new_password)) {
    return res.render('profile', { error: 'New password is too weak', user: req.session.user });
  }

  //hash and update new password
  const newHash = await argon2.hash(new_password);
  await db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, req.session.user.id]);

  //destroy session to force re-login
  req.session.destroy(() => res.redirect('/login'));
});

//profile update email
app.post('/profile/update-email', async (req, res) => {
  if (!currentUser(req)) return res.redirect('/login');

  //update email
  const { current_password, new_email } = req.body;
  const user = await db.get(`SELECT * FROM users WHERE id = ?`, [req.session.user.id]);

  //verify current password
  if (!await argon2.verify(user.password_hash, current_password)) {
    return res.render('profile', { error: 'Current password is incorrect', user });
  }

  //validate new email
  if (!validate.email(new_email)) {
    return res.render('profile', { error: 'Invalid email address', user });
  }

  //update email in database
  try {
    await db.run(`UPDATE users SET email = ? WHERE id = ?`, [new_email, req.session.user.id]);
    res.render('profile', { success: 'Email updated successfully', user });
  } catch (err) {
    res.render('profile', { error: 'Email already in use', user });
  }
});

//profile update display name
app.post('/profile/update-display-name', async (req, res) => {
  if (!currentUser(req)) return res.redirect('/login');

  const { new_display_name } = req.body;

  //validate display name
  if (!validate.displayName(req.session.user.username, new_display_name)) {
    return res.render('profile', { error: 'Invalid display name', user: req.session.user });
  }

  //update display name in database
  await db.run(`UPDATE users SET display_name = ? WHERE id = ?`, [new_display_name, req.session.user.id]);

  //update session info
  req.session.user.display_name = new_display_name;

  res.render('profile', { success: 'Display name updated', user: req.session.user });
});

//profile update profile color
app.post('/profile/update-color', async (req, res) => {
  if (!currentUser(req)) return res.redirect('/login');

  const { profile_color } = req.body;

  //update profile color in database
  await db.run(`UPDATE users SET profile_color = ? WHERE id = ?`, [profile_color, req.session.user.id]);

  //update session info
  req.session.user.profile_color = profile_color;
  //render profile with success message
  res.render('profile', { success: 'Profile color updated', user: req.session.user });
});

//forgot password
app.get('/forgot', (req, res) => {
  res.render('forgot', { title: 'Forgot Password' });
});

//forgot password post
app.post('/forgot', async (req, res) => {
  const { email } = req.body;
  const user = await db.get(`SELECT id, display_name FROM users WHERE email = ?`, [email]);

  //user must exist
  if (!user) {
    return res.render('forgot', { error: 'No account found with that email.' });
  }

  //generate reset token
  const token = crypto.randomBytes(32).toString('hex');
  const expires_at = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry

  //store token in database
  await db.run(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
    [user.id, token, expires_at]
  );


  //send reset email
  await mailer.sendResetEmail(email, token);
  res.render('forgot', { success: 'Password reset link sent. Check your email!' });
});

//reset password page
app.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect('/login');
  //validate token
  const row = await db.get(
    `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?`,
    [token, Math.floor(Date.now() / 1000)]
  );
  //verify token validity
  if (!row) return res.send('Invalid or expired token.');
  //render reset password page
  res.render('reset_password', { token });
});

//reset password post
app.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;

  //validate new password strength
  if (!validate.strongPassword(new_password)) {
    return res.send('Password does not meet strength requirements.');
  }

  //validate token against database
  const row = await db.get(
    `SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > ?`,
    [token, Math.floor(Date.now() / 1000)]
  );

  //verify token validity
  if (!row) return res.send('Invalid or expired token.');

  //update user password
  const newHash = await argon2.hash(new_password);
  await db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, row.user_id]);
  //mark token as used
  await db.run(`UPDATE password_reset_tokens SET used = 1 WHERE id = ?`, [row.id]);

  res.send('Password reset successful. You can now <a href="/login">login</a>.');
});

//chat page
app.get('/chat', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('chat', { user: req.session.user });
});

//user comment history
app.get('/user/:id/comments', async (req, res) => {
  const userId = parseInt(req.params.id);
  const COMMENTS_PER_PAGE = 20;
  const page = parseInt(req.query.page) || 1;

  //fetch user info
  const user = await db.get(`SELECT username, display_name, profile_color FROM users WHERE id = ?`, [userId]);
  if (!user) return res.status(404).send('User not found');

  //total comments by user
  const totalRow = await db.get(`SELECT COUNT(*) AS count FROM comments WHERE user_id = ?`, [userId]);
  const totalComments = totalRow.count;

  //calculate pagination
  const totalPages = Math.ceil(totalComments / COMMENTS_PER_PAGE);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * COMMENTS_PER_PAGE;

  //fetch paginated comments from database
  const comments = await db.all(`
    SELECT comments.text, comments.created_at, comments.user_id, users.display_name, users.profile_color
    FROM comments
    JOIN users ON comments.user_id = users.id
    WHERE comments.user_id = ?
    ORDER BY comments.id DESC
    LIMIT ? OFFSET ?
  `, [userId, COMMENTS_PER_PAGE, offset]);

  //render user comments page
  res.render('user_comments', {
    title: `${user.display_name}'s Comments`,
    comments,
    profileUser: user,
    pagination: {
      current: safePage,
      totalPages
    },
    user: req.session.user
  });
});


//start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

