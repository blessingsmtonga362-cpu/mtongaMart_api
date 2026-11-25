import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `mtongamart/${folder}`,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );

        Readable.from(file.buffer).pipe(uploadStream);
      });

      return result.secure_url;
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      throw new InternalServerErrorException('Failed to upload image');
    }
  }
}
