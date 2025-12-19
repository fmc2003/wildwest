// modules/chat.js
const db = require('./db');

function initChat(io, sessionMiddleware) {
  //attach session to socket.io
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  //handle socket connections
  io.on('connection', async (socket) => {
    const req = socket.request;

    if (!req.session || !req.session.user) {
      console.log('Unauthorized socket connection');
      return socket.disconnect(true);
    }

    const user = req.session.user;
    console.log(`User connected: ${user.username} (${socket.id})`);

    //load last 50 messages
    const messages = await db.all(`
      SELECT cm.text, u.display_name, u.profile_color, cm.timestamp
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.id
      ORDER BY cm.id DESC
      LIMIT 50
    `);

    //send chat history to user
    socket.emit('chat history', messages.reverse());

    //incoming chat messages
    socket.on('chat message', async (data) => {
      const text = (data.text || '').trim();
      if (!text) return;

      const timestamp = Math.floor(Date.now() / 1000);

      //save to database
      await db.run(
        `INSERT INTO chat_messages (user_id, text, timestamp) VALUES (?, ?, ?)`,
        [user.id, text, timestamp]
      );

      //broadcast to all users
      io.emit('chat message', {
        user_id: user.id,
        text,
        display_name: user.display_name,
        profile_color: user.profile_color,
        timestamp
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.username} (${socket.id})`);
    });
  });
}

module.exports = initChat;
