import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  Role,
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '@laundry/shared'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { UsersService } from './users.service'

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.OWNER)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar akun staff (OWNER)' })
  findAll() {
    return this.usersService.findAll()
  }

  @Post()
  @ApiOperation({ summary: 'Tambah akun staff (OWNER)' })
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.usersService.create(body)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah akun staff (OWNER)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    return this.usersService.update(id, body)
  }
}
