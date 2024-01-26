import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { validate as isUUID } from 'uuid';
import { ErrorHandler } from 'src/common/errors/error.handler';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private readonly errorHandler: ErrorHandler,
  ) {
    this.errorHandler.name = 'ProductsService';
  }

  async create(createProductDto: CreateProductDto) {
    try {
      const product = this.productRepository.create(createProductDto);
      await this.productRepository.save(product);

      return product;
    } catch (error) {
      this.errorHandler.handleError(error);
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
          // TODO: relaciones
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
        products,
      };
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  async findOne(term: string) {
    let product: Product;

    try {
      if (isUUID(term))
        product = await this.productRepository.findOneBy({ id: term });

      if (!isUUID(term)) {
        const queryBuilder = this.productRepository.createQueryBuilder();
        product = await queryBuilder
          .where(`LOWER(title) = :title or LOWER(slug) = :slug`, {
            title: term.toLowerCase(),
            slug: term.toLowerCase(),
          })
          .getOne();
      }

      if (!product)
        throw `Product with ${isUUID(term) ? 'id' : 'slug'} ${term} not found`;

      return product;
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      const product = await this.productRepository.preload({
        id: id,
        ...updateProductDto,
      });

      if (!product) throw `Product with id: ${id} not found`;

      return await this.productRepository.save(product);
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  async remove(id: string) {
    try {
      const res = await this.productRepository.delete(id);

      if (res.affected === 0) throw `Product with id ${id} not found`;
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }
}
