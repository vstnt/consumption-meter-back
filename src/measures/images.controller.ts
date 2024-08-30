import { Controller, Get, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import { MeasuresService } from './services/measures.service';
import { Response } from 'express';

@Controller('images')
export class ImagesController {
  constructor(private readonly measuresService: MeasuresService) {}

  @Get(':id')
  async serveImage(@Param('id') id: string, @Res() res: Response) {
    const measure = await this.measuresService.findById(id);

    if (!measure || !measure.image_data) {
      throw new HttpException('Imagem não encontrada', HttpStatus.NOT_FOUND);
    }

    if (measure.image_expiration && new Date() > measure.image_expiration) {
      throw new HttpException('A imagem expirou', HttpStatus.GONE);
    }

    const imageBuffer = Buffer.from(measure.image_data, 'base64');
    res.end(imageBuffer);
  }
}
