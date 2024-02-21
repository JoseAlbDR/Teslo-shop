import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';
import { ErrorHandler } from 'src/common/errors/error.handler';
import { ProductImage, Product } from './entities';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,

    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource,

    private errorHandler: ErrorHandler,
  ) {
    this.errorHandler.name = 'ProductsService';
  }

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto;

      const product = this.productRepository.create({
        ...productDetails,
        images: images.map((image) =>
          this.productImageRepository.create({ url: image }),
        ),
      });
      await this.productRepository.save(product);

      return { ...product, images };
    } catch (error) {
      this.errorHandler.handle(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, page = 1 } = paginationDto;

    try {
      const [total, products] = await Promise.all([
        await this.productRepository.count(),
        await this.productRepository.find({
          take: limit,
          skip: (page - 1) * limit,
          relations: {
            images: true,
          },
        }),
      ]);

      const maxPages = Math.ceil(total / limit);

      return {
        currentPage: page,
        maxPages,
        limit,
        total,
        next:
          page + 1 <= maxPages
            ? `/api/products?page=${page + 1}&limit=${limit}`
            : null,
        prev:
          page - 1 > 0 ? `/api/products?page=${page - 1}&limit=${limit}` : null,
        products: products.map((product) => ({
          ...product,
          images: product.images.map((img) => img.url),
        })),
      };
    } catch (error) {
      this.errorHandler.handle(error);
    }
  }

  async findOne(term: string) {
    let product: Product;

    try {
      if (isUUID(term))
        product = await this.productRepository.findOneBy({ id: term });

      if (!isUUID(term)) {
        const queryBuilder = this.productRepository.createQueryBuilder('prod');
        product = await queryBuilder
          .where(`LOWER(title) = :title or LOWER(slug) = :slug`, {
            title: term.toLowerCase(),
            slug: term.toLowerCase(),
          })
          .leftJoinAndSelect('prod.images', 'prodImages')
          .getOne();
      }

      if (!product)
        throw `Product with ${isUUID(term) ? 'id' : 'slug'} ${term} not found`;

      return product;
    } catch (error) {
      this.errorHandler.handle(error);
    }
  }

  async findOnePlain(term: string) {
    const { images, ...rest } = await this.findOne(term);

    return {
      ...rest,
      images: images.map((image) => image.url),
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...rest } = updateProductDto;
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      const product = await this.productRepository.preload({
        id,
        ...rest,
      });

      if (!product) throw `Product with id: ${id} not found`;

      // Create query runner
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // Foreign key productId in ProductImages with id that is product id
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id: id } });

        product.images = images.map((image) =>
          this.productImageRepository.create({ url: image }),
        );
      }

      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      return this.findOnePlain(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.errorHandler.handle(error);
    }
  }

  async remove(id: string) {
    try {
      const res = await this.productRepository.delete(id);

      if (res.affected === 0) throw `Product with id ${id} not found`;
    } catch (error) {
      this.errorHandler.handle(error);
    }
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('product');

    try {
      return await query.delete().where({}).execute();
    } catch (error) {
      this.errorHandler.handle(error);
    }
  }
}
