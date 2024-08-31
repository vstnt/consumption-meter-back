import { Test, TestingModule } from '@nestjs/testing';
import { MeasuresService } from '../services/measures.service';
import { Measure } from '../entities/measure.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoogleGenerativeAIService } from '../services/google-generative-ai.service';
import { ConfirmMeasureDto } from '../dto/confirm-measure.dto';
import { MeasurementRequest } from '../interfaces/measurement-request.interface';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InvalidDataRequestException } from '../exceptions/invalid-data-request.exception';

jest.mock('fs');

describe('MeasuresService', () => {
  let service: MeasuresService;
  let repository: Repository<Measure>;
  let googleGenerativeAIService: GoogleGenerativeAIService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockGoogleService = {
    makeMeasureWithGenAI: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeasuresService,
        {
          provide: getRepositoryToken(Measure),
          useValue: mockRepository,
        },
        {
          provide: GoogleGenerativeAIService,
          useValue: mockGoogleService,
        },
      ],
    }).compile();

    service = module.get<MeasuresService>(MeasuresService);
    repository = module.get<Repository<Measure>>(getRepositoryToken(Measure));
    googleGenerativeAIService = module.get<GoogleGenerativeAIService>(GoogleGenerativeAIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new measure', async () => {
      const measurementRequest: MeasurementRequest = {
        customer_code: '123',
        measure_datetime: new Date().toISOString(),
        measure_type: 'WATER',
        image: 'data:image/png;base64,validBase64ImageData',
      };

      const mockSavedMeasure = {
        id: '1',
        customer_code: measurementRequest.customer_code,
        measure_datetime: new Date(),
        measure_value: 100,
        measure_type: measurementRequest.measure_type,
        image_data: 'validBase64ImageData',
        image_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockRepository.save.mockResolvedValue(mockSavedMeasure);
      mockGoogleService.makeMeasureWithGenAI.mockResolvedValue({ measure: 100 });

      const result = await service.create(measurementRequest, 'http://localhost:3000');

      expect(result).toEqual({
        image_url: 'http://localhost:3000/images/1',
        measure_value: 100,
        measure_uuid: '1',
      });
      expect(repository.save).toHaveBeenCalled();
      expect(googleGenerativeAIService.makeMeasureWithGenAI).toHaveBeenCalled();
    });

    it('should throw an exception if the image is invalid', async () => {
      const measurementRequest: MeasurementRequest = {
        customer_code: '123',
        measure_datetime: new Date().toISOString(),
        measure_type: 'WATER',
        image: 'invalidBase64Data',
      };

      await expect(service.create(measurementRequest, 'http://localhost:3000')).rejects.toThrow(
        InvalidDataRequestException,
      );
    });
  });

  describe('confirm', () => {
    it('should confirm an existing measure', async () => {
      const confirmMeasureDto: ConfirmMeasureDto = {
        measure_uuid: '550e8400-e29b-41d4-a716-446655440000',
        confirmed_value: 200,
      };

      const existingMeasure = {
        id: confirmMeasureDto.measure_uuid,
        is_confirmed: false,
        measure_value: 100,
      };

      mockRepository.findOne.mockResolvedValue(existingMeasure);

      const result = await service.confirm(confirmMeasureDto);

      expect(result).toEqual({ success: true });
      expect(repository.save).toHaveBeenCalledWith({
        ...existingMeasure,
        measure_value: confirmMeasureDto.confirmed_value,
        is_confirmed: true,
      });
    });

    it('should throw an exception if the measure is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const confirmMeasureDto: ConfirmMeasureDto = {
        measure_uuid: '550e8400-e29b-41d4-a716-446655440000',
        confirmed_value: 200,
      };

      await expect(service.confirm(confirmMeasureDto)).rejects.toThrow(
        new HttpException(
          {
            error_code: 'MEASURE_NOT_FOUND',
            error_description: 'Leitura não encontrada',
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw an exception if the measure is already confirmed', async () => {
      const existingMeasure = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        is_confirmed: true,
        measure_value: 100,
      };

      mockRepository.findOne.mockResolvedValue(existingMeasure);

      const confirmMeasureDto: ConfirmMeasureDto = {
        measure_uuid: existingMeasure.id,
        confirmed_value: 200,
      };

      await expect(service.confirm(confirmMeasureDto)).rejects.toThrow(
        new HttpException(
          {
            error_code: 'CONFIRMATION_DUPLICATE',
            error_description: 'Leitura do mês já realizada',
          },
          HttpStatus.CONFLICT,
        ),
      );
    });
  });

  describe('list', () => {
    it('should return a list of measures', async () => {
      const customer_code = '123';
      const measure_type = 'WATER';
      const measures = [
        {
          id: '1',
          customer_code,
          measure_datetime: new Date(),
          measure_type,
          is_confirmed: false,
          measure_value: 100,
        },
      ];

      mockRepository.getMany.mockResolvedValue(measures);

      const result = await service.list('http://localhost:3000', customer_code, measure_type);

      expect(result).toEqual({
        customer_code,
        measures: measures.map(measure => ({
          measure_uuid: measure.id,
          measure_datetime: measure.measure_datetime,
          measure_type: measure.measure_type,
          has_confirmed: measure.is_confirmed,
          image_url: `http://localhost:3000/images/${measure.id}`,
        })),
      });
    });

    it('should throw an exception if no measures are found', async () => {
      mockRepository.getMany.mockResolvedValue([]);

      await expect(service.list('http://localhost:3000', '123', 'WATER')).rejects.toThrow(
        new HttpException(
          {
            error_code: 'MEASURES_NOT_FOUND',
            error_description: 'Nenhuma leitura encontrada',
          },
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('should throw an exception if the measure type is invalid', async () => {
      await expect(service.list('http://localhost:3000', '123', 'INVALID_TYPE')).rejects.toThrow(
        new HttpException(
          {
            error_code: 'INVALID_TYPE',
            error_description: 'Tipo de medição não permitida',
          },
          HttpStatus.BAD_REQUEST,
        ),
      );
    });
  });

  describe('findById', () => {
    it('should return a measure by id', async () => {
      const measure = {
        id: '1',
        customer_code: '123',
        measure_datetime: new Date(),
        measure_type: 'WATER',
        is_confirmed: false,
        measure_value: 100,
      };

      mockRepository.findOne.mockResolvedValue(measure);

      const result = await service.findById('1');

      expect(result).toEqual(measure);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });
});
