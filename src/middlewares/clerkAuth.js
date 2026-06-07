const { verifyToken } = require("@clerk/backend");

const clerkMiddleware = async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication Error"));
  }
  try {
    const verifiedToken = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    // attach user's unique id to socket object
    socket.userId = verifiedToken.sub;

    next();
  } catch (error) {
    next(new Error("Authentication error"));
  }
};

module.exports = { clerkMiddleware };
