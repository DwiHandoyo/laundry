import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'owner@laundry.id' })
  email!: string

  @ApiProperty({ example: 'owner12345' })
  password!: string
}

export class RefreshDto {
  @ApiProperty()
  refreshToken!: string
}
