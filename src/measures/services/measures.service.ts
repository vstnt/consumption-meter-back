import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MeasurementRequest } from '../interfaces/measurement-request.interface';
import { isBase64 } from 'class-validator';
import { InvalidDataRequestException } from 'src/common/exceptions/invalid-data-request.exception';
import { GoogleGenerativeAIService } from './google-generative-ai.service';
import * as fs from 'fs';
import * as path from 'path';
import * as uuid from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { Measure } from '../entities/measure.entity';
import { Repository } from 'typeorm';
import { ConfirmMeasureDto } from '../dto/confirm-measure.dto';

@Injectable()
export class MeasuresService {
  constructor(
    private readonly googleGenerativeAIService: GoogleGenerativeAIService,
    @InjectRepository(Measure)
    private readonly measureRepository: Repository<Measure>,
  ) {}


  async create(measurementRequest: MeasurementRequest, thisUrlPath: string) {
    // Validação e transformação da imagem
    const { imageBase64, imageMimeType } = this.validateImage(measurementRequest.image);

    const measureDate = new Date(measurementRequest.measure_datetime);
    await this.checkExistingMeasure(
      measurementRequest.customer_code,
      measurementRequest.measure_type,
      measureDate
    );
    
    // Criar um arquivo temporário
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const tempFilePath = path.join(__dirname, `${uuid.v4()}.${imageMimeType.split('/')[1]}`);
    fs.writeFileSync(tempFilePath, imageBuffer);

    const GeminiResponse = this.googleGenerativeAIService.makeMeasureWithGenAI(tempFilePath, imageMimeType);

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 1);

    // Persistir a nova medida no banco de dados
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

  // Método para confirmar ou corrigir a medida
  async confirm(confirmMeasureDto: ConfirmMeasureDto) {
    const { measure_uuid, confirmed_value } = confirmMeasureDto;

    // Verificar se o código de leitura existe
    const existingMeasure = await this.measureRepository.findOne({
      where: { id: measure_uuid },
    });

    if (!existingMeasure) {
      throw new HttpException({
        error_code: 'MEASURE_NOT_FOUND',
        error_description: 'Leitura não encontrada',
      }, HttpStatus.NOT_FOUND);
    }

    // Verificar se a leitura já foi confirmada
    if (existingMeasure.is_confirmed) {
      throw new HttpException({
        error_code: 'CONFIRMATION_DUPLICATE',
        error_description: 'Leitura do mês já realizada',
      }, HttpStatus.CONFLICT);
    }

    // Atualizar o valor confirmado e marcar como confirmado
    existingMeasure.measure_value = confirmed_value;
    existingMeasure.is_confirmed = true;

    await this.measureRepository.save(existingMeasure);

    return { success: true };
  }

  // Método para listar medidas de um cliente
  async list(thisUrlPath: string, customer_code: string, measure_type?: string) {
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

    const measures = await query.getMany();

    if (measures.length === 0) {
      throw new HttpException({
        error_code: 'MEASURES_NOT_FOUND',
        error_description: 'Nenhuma leitura encontrada',
      }, HttpStatus.NOT_FOUND);
    }

    return {
      customer_code,
      measures: measures.map(measure => ({
        measure_uuid: measure.id,
        measure_datetime: measure.measure_datetime,
        measure_type: measure.measure_type,
        has_confirmed: measure.is_confirmed,
        image_url: thisUrlPath+'/images/'+measure.id
      })),
    };
  }

  async findById(id: string): Promise<Measure | null> {
    return this.measureRepository.findOne({ where: { id } });
  }


  private async checkExistingMeasure(customer_code: string, measure_type: string, measureDate: Date) {
    const existingMeasure = await this.measureRepository.findOne({
      where: {
        customer_code: customer_code,
        measure_type: measure_type,
        measure_datetime: measureDate,
      },
      order: { measure_datetime: 'DESC' },
    });

    if (existingMeasure) {
      const currentMonth = measureDate.getMonth();
      const measureMonth = new Date(existingMeasure.measure_datetime).getMonth();

      if (currentMonth === measureMonth) {
        throw new HttpException({
          error_code: 'DOUBLE_REPORT',
          error_description: 'Leitura do mês já realizada',
        }, HttpStatus.CONFLICT);
      }
    }
  }

  private validateImage(measurementRequestImage: string) {
    let imageBase64: string;
    let imageMimeType: string | null = null;

    if (measurementRequestImage.includes(',')) {
      // Caso com prefixo data:image/png;base64, etc.
      const [prefix, base64Data] = measurementRequestImage.split(',');

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