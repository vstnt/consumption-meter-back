import { Test, TestingModule } from '@nestjs/testing';
import { MeasuresController } from '../measures.controller';
import { MeasuresService } from '../services/measures.service';
import { CreateMeasureDto } from '../dto/create-measure.dto';
import { ConfirmMeasureDto } from '../dto/confirm-measure.dto';
import { Request } from 'express';

describe('MeasuresController', () => {
  let controller: MeasuresController;
  let service: MeasuresService;

  const mockMeasuresService = {
    create: jest.fn(),
    confirm: jest.fn(),
    list: jest.fn(),
  };

  const mockRequest = (): Partial<Request> => ({
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:3000'),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeasuresController],
      providers: [
        {
          provide: MeasuresService,
          useValue: mockMeasuresService,
        },
      ],
    }).compile();

    controller = module.get<MeasuresController>(MeasuresController);
    service = module.get<MeasuresService>(MeasuresService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a measure', async () => {
    const createMeasureDto: CreateMeasureDto = {
      image: 'imageData',
      customer_code: '123',
      measure_datetime: new Date().toISOString(),
      measure_type: 'gas',
    };
    const mockResult = { id: '1', ...createMeasureDto };
    mockMeasuresService.create.mockResolvedValue(mockResult);

    const req = mockRequest() as Request;
    const result = await controller.createMeasure(createMeasureDto, req);

    expect(result).toBe(mockResult);
    expect(service.create).toHaveBeenCalledWith(createMeasureDto, 'http://localhost:3000');
  });

  it('should confirm a measure', async () => {
    const confirmMeasureDto: ConfirmMeasureDto = {
      measure_uuid: '550e8400-e29b-41d4-a716-446655440000', // UUID válido
      confirmed_value: 100, // Valor inteiro
    };
    const mockResult = { id: '1', confirmed: true };
    mockMeasuresService.confirm.mockResolvedValue(mockResult);

    const result = await controller.confirmMeasure(confirmMeasureDto);

    expect(result).toBe(mockResult);
    expect(service.confirm).toHaveBeenCalledWith(confirmMeasureDto);
  });

  it('should list measures', async () => {
    const customer_code = '123';
    const measure_type = 'water';
    const mockResult = [
      { id: '1', customer_code, measure_type: 'WATER', measure_value: 100 },
    ];
    mockMeasuresService.list.mockResolvedValue(mockResult);

    const req = mockRequest() as Request;
    const result = await controller.listMeasures(req, customer_code, measure_type);

    expect(result).toBe(mockResult);
    expect(service.list).toHaveBeenCalledWith('http://localhost:3000', customer_code, measure_type);
  });
});
