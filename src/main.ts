import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

function validateEnvVariables() {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
    'GEMINI_API_KEY',
  ];

  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      throw new Error(`Variável de ambiente ${envVar} não está definida.`);
    }
  });
}


async function bootstrap() {
  validateEnvVariables();  // Validação das variáveis de ambiente
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ 
    exceptionFactory: (errors) => {
      const errorDescription = errors.map(
        error => `${error.property} has wrong value ${error.value}, ${Object.values(error.constraints).join(', ')}`
      ).join('; ');
  
      return new BadRequestException({
        error_code: 'INVALID_DATA',
        error_description: errorDescription,
      });
    },
  }));

  app.use(bodyParser.json({ limit: '20mb' }));
  app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));

  await app.listen(3000);
}
bootstrap();
