import app from './app';
import { logger } from './utils/logger';
import { PrismaClient } from '@prisma/client';
import { initializeDatabase } from './utils/initDb';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    logger.info('Connecting to database...');
    await prisma.$connect();
    logger.info('Database connected successfully.');

    await initializeDatabase();

    // Bind explicitly to 0.0.0.0 to prevent silent port collision on Windows
    const server = app.listen(PORT as number, '0.0.0.0', () => {
      logger.info(`Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
    
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. The application will now exit.`);
        process.exit(1);
      }
      logger.error(`Server error: ${error.message}`);
    });

    if (server && server.ref) {
      server.ref();
    }

    server.on('close', () => {
      logger.warn('SERVER SOCKET CLOSED.');
    });

    process.on('unhandledRejection', (err: Error) => {
      logger.error(`Unhandled Rejection: ${err.message}`);
      server.close();
      prisma.$disconnect().finally(() => process.exit(1));
    });

    // Handle shutdown gracefully but don't hang on keep-alive connections
    const shutdown = () => {
      logger.info('Received shutdown signal. Initiating teardown...');
      
      // Tell the server to stop accepting new connections
      server.close();
      
      // Disconnect DB and exit
      prisma.$disconnect().finally(() => {
        logger.info('Teardown complete. Exiting process.');
        process.exit(0);
      });
      
      // Fallback: force kill after 3s to prevent zombie processes during nodemon restarts
      setTimeout(() => {
        logger.error('Shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 3000).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGUSR2', shutdown); // specifically for nodemon

  } catch (error) {
    logger.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

bootstrap();
