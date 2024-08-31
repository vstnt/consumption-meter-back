import { Module } from '@nestjs/common';
import { MeasuresController } from './measures.controller';
import { MeasuresService } from './services/measures.service';
import { GoogleGenerativeAIService } from './services/google-generative-ai.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Measure } from './entities/measure.entity';
import { ImagesController } from './images.controller';


@Module({

    imports: [TypeOrmModule.forFeature([Measure])],
    controllers: [MeasuresController, ImagesController],
    providers: [MeasuresService, GoogleGenerativeAIService],
    exports: [MeasuresService],
    
})
export class MeasuresModule {}
