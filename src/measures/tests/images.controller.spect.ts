import { Test, TestingModule } from '@nestjs/testing';
import { ImagesController } from '../images.controller';
import { MeasuresService } from '../services/measures.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

describe('ImagesController', () => {
  let controller: ImagesController;
  let service: MeasuresService;

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.end = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  const mockMeasuresService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        {
          provide: MeasuresService,
          useValue: mockMeasuresService,
        },
      ],
    }).compile();

    controller = module.get<ImagesController>(ImagesController);
    service = module.get<MeasuresService>(MeasuresService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should throw an exception if image is not found', async () => {
    mockMeasuresService.findById.mockResolvedValue(null);

    await expect(controller.serveImage('invalid-id', mockResponse())).rejects.toThrow(
      new HttpException('Imagem não encontrada', HttpStatus.NOT_FOUND),
    );
  });

  it('should throw an exception if image has expired', async () => {
    const expiredMeasure = {
      image_data: 'someImageData',
      image_expiration: new Date(Date.now() - 1000), // Data expirada
    };
    mockMeasuresService.findById.mockResolvedValue(expiredMeasure);

    await expect(controller.serveImage('expired-id', mockResponse())).rejects.toThrow(
      new HttpException('A imagem expirou', HttpStatus.GONE),
    );
  });

  it('should serve the image if it is found and not expired', async () => {
    const validMeasure = {
      image_data: 'validImageData',
      image_expiration: new Date(Date.now() + 1000), // Data válida
    };
    mockMeasuresService.findById.mockResolvedValue(validMeasure);

    const res = mockResponse();
    await controller.serveImage('valid-id', res);

    expect(res.end).toHaveBeenCalledWith(Buffer.from(validMeasure.image_data, 'base64'));
  });
});
