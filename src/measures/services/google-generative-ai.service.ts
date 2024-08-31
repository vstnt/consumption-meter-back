import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from "@google/generative-ai/server";


@Injectable()
export class GoogleGenerativeAIService {
  private readonly genAI;
  private readonly fileManager;
  private model;
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
      });
  }

  async makeMeasureWithGenAI(imagePath: string, mimeType: string) {  
    try {
      const uploadedFile = await this.fileManager.uploadFile( imagePath, {mimeType: mimeType,} )

      const modelResponse = await this.model.generateContent([
        { text: "Estou lhe enviando a foto de um medidor de consumo de água ou gás. Você vai extrair o valor da imagem. Me retorne como resposta apenas o valor inteiro no medidor e nada mais, Sem quaisquer outras palavras ou pontuação." },
        {
          fileData: {
            mimeType: uploadedFile.file.mimeType,
            fileUri: uploadedFile.file.uri
          }
        },
      ]);

      const responseText  = await modelResponse.response.text()
      const responseTextClean = parseInt((responseText.trim()).replace(/\D/g, ''), 10);
      
      return {
        measure: responseTextClean,
        fileUri: uploadedFile.file.uri,
      };
    } 
    catch (error) {
      console.error('Erro ao processar a imagem com o Google Generative AI:', error);
      throw new Error('Failed to process the image with Google Generative AI');
    }
  }

}