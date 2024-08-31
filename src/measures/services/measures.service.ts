import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MeasurementRequest } from '../interfaces/measurement-request.interface';
import { isBase64 } from 'class-validator';
import { InvalidDataRequestException } from '../exceptions/invalid-data-request.exception';
import { GoogleGenerativeAIService } from './google-generative-ai.service';
import * as fs from 'fs';
import * as path from 'path';
import * as uuid from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Measure } from '../entities/measure.entity';
import { Between, Repository } from 'typeorm';
import { ConfirmMeasureDto } from '../dto/confirm-measure.dto';


@Injectable()
export class MeasuresService {
  constructor(
    private readonly googleGenerativeAIService: GoogleGenerativeAIService,
    @InjectRepository(Measure)
    private readonly measureRepository: Repository<Measure>,
  ) {}


  async create(measurementRequest: MeasurementRequest, thisUrlPath: string) {
    
    const measureDate = new Date(measurementRequest.measure_datetime);
    await this.checkExistingMeasure(measurementRequest.customer_code, measurementRequest.measure_type, measureDate);
    
    const { imageBase64, imageMimeType } = this.validateImage(measurementRequest.image);
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const tempFilePath = path.join(__dirname, `${uuid.v4()}.${imageMimeType.split('/')[1]}`);
    fs.writeFileSync(tempFilePath, imageBuffer);

    const GeminiResponse = this.googleGenerativeAIService.makeMeasureWithGenAI(tempFilePath, imageMimeType);

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 1);

    const newMeasure = this.measureRepository.create({
      customer_code: measurementRequest.customer_code,
      measure_datetime: measureDate,
      measure_value: (await GeminiResponse).measure,
      measure_type: measurementRequest.measure_type,
      image_data: imageBase64,
      image_expiration: expirationDate,
    });
    const savedMeasure = await this.measureRepository.save(newMeasure);

    const imageUrl = `${thisUrlPath}/images/${savedMeasure.id}`;
    
    return {
      image_url: imageUrl,
      measure_value: savedMeasure.measure_value,
      measure_uuid: savedMeasure.id,
    };
  }


  async confirm(confirmMeasureDto: ConfirmMeasureDto) {
    
    const { measure_uuid, confirmed_value } = confirmMeasureDto;

    const existingMeasure = await this.measureRepository.findOne({
      where: { id: measure_uuid },
    });
    
    if (!existingMeasure) {
      throw new HttpException({
        error_code: 'MEASURE_NOT_FOUND',
        error_description: 'Leitura não encontrada',
      }, HttpStatus.NOT_FOUND);
    }

    if (existingMeasure.is_confirmed) {
      throw new HttpException({
        error_code: 'CONFIRMATION_DUPLICATE',
        error_description: 'Leitura do mês já realizada',
      }, HttpStatus.CONFLICT);
    }

    existingMeasure.measure_value = confirmed_value;
    existingMeasure.is_confirmed = true;
    await this.measureRepository.save(existingMeasure);

    return { success: true };
  }


  async list(aplicationPath: string, customer_code: string, measure_type?: string) {
    
    const query = this.measureRepository.createQueryBuilder('measure')
    .where('measure.customer_code = :customer_code', { customer_code });

    if (measure_type) {
      const validTypes = ['WATER', 'GAS'];
      const normalizedType = measure_type.toUpperCase();

      if (!validTypes.includes(normalizedType)) {
        throw new HttpException({
          error_code: 'INVALID_TYPE',
          error_description: 'Tipo de medição não permitida',
        }, HttpStatus.BAD_REQUEST);
      }

      query.andWhere('measure.measure_type = :measure_type', { measure_type: normalizedType });
    }

    const retrievedMeasures = await query.getMany();

    if (retrievedMeasures.length === 0) {
      throw new HttpException({
        error_code: 'MEASURES_NOT_FOUND',
        error_description: 'Nenhuma leitura encontrada',
      }, HttpStatus.NOT_FOUND);
    }

    return {
      customer_code,
      measures: retrievedMeasures.map(measure => ({
        measure_uuid: measure.id,
        measure_datetime: measure.measure_datetime,
        measure_type: measure.measure_type,
        has_confirmed: measure.is_confirmed,
        image_url: aplicationPath+'/images/'+measure.id
      })),
    };
  }


  async findById(id: string): Promise<Measure | null> {
    return this.measureRepository.findOne({ where: { id } });
  }




  private async checkExistingMeasure(customer_code: string, measure_type: string, measureDate: Date) {
    
    const startOfMonth = new Date(measureDate.getFullYear(), measureDate.getMonth(), 1);
    const endOfMonth = new Date(measureDate.getFullYear(), measureDate.getMonth() + 1, 0, 23, 59, 59);
  
    const existingMeasure = await this.measureRepository.findOne({
      where: {
        customer_code: customer_code,
        measure_type: measure_type,
        measure_datetime: Between(startOfMonth, endOfMonth),
      },
      order: { measure_datetime: 'DESC' },
    });
  
    if (existingMeasure) {
      throw new HttpException({
        error_code: 'DOUBLE_REPORT',
        error_description: 'Leitura do mês já realizada',
      }, HttpStatus.CONFLICT);
    }

  }


  private validateImage(measurementImage: string) {
    
    let imageBase64: string;
    let imageMimeType: string | null = null;

    if (measurementImage.includes(',')) {
      // Caso com prefixo data:image/png;base64, etc.
      const [prefix, base64Data] = measurementImage.split(',');

      if (!prefix.startsWith('data:') || !prefix.includes(';base64')) {
        throw new InvalidDataRequestException('Formato de imagem inválido');
      }

      imageMimeType = prefix.substring(5, prefix.indexOf(';'));
      imageBase64 = base64Data;
      
    } else {
      // Caso sem prefixo
      throw new InvalidDataRequestException('A imagem deve ser uma string codificada em Base64 válida. O mimetype está ausente.');
    }

    if (!isBase64(imageBase64)) {
      throw new InvalidDataRequestException('A imagem deve ser uma string codificada em Base64 válida.');

    }

    return { imageBase64, imageMimeType };
  }

}