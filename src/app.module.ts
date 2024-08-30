import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeasuresModule } from './measures/measures.module';
import { Measure } from './measures/entities/measure.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'consumption_meter_user',
      password: 'testeshopper',
      database: 'consumption_meter_db',
      entities: [Measure],
      synchronize: true,
    }),
    MeasuresModule,
  ],
})
export class AppModule {}
