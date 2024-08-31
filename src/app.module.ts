import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeasuresModule } from './measures/measures.module';
import { Measure } from './measures/entities/measure.entity';


@Module({
  
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Measure],
      synchronize: true,
    }),
    MeasuresModule,
  ],
  
})
export class AppModule {}