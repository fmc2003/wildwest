const path = require('path');
const express = require('express');
const { engine } = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 3000;

// Handlebars setup
app.engine('hbs', engine({
  extname: '.hbs',
  partialsDir: path.join(__dirname, 'public/views/partials')  // ✅ Add this
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public/views')); // ✅ Views dir

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Example route
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login Page' });
});

app.get('/register', (req, res) => {
  res.render('register', { title: 'Register Page' });
});

app.get('/', (req, res) => {
  res.render('home', { title: 'Home Page' });
});

app.get('/comments', (req, res) => {
  res.render('comments', { title: 'Comment Page' });
});

app.get('/new-comment', (req, res) => {
  res.render('new_comment', { title: 'New Comment' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
