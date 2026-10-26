import { ParseUUIDPipe, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { PermissionFlagType } from 'twenty-shared/constants';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AuthPrincipalGuard } from 'src/engine/guards/auth-principal.guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { EmailTemplateDTO } from 'src/modules/emailing/dtos/email-template.dto';
import { SaveEmailTemplateInput } from 'src/modules/emailing/dtos/save-email-template.input';
import { EmailTemplateService } from 'src/modules/emailing/services/email-template.service';

@MetadataResolver(() => EmailTemplateDTO)
@UsePipes(ResolverValidationPipe)
@UseFilters(AuthGraphqlApiExceptionFilter)
@UseGuards(
  AuthPrincipalGuard({
    userSession: {
      standard: true,
      impersonated: true,
      playground: true,
      workspaceAgnostic: false,
    },
    apiKey: true,
    oauthClient: true,
    application: true,
  }),
  SettingsPermissionGuard(PermissionFlagType.SEND_EMAIL_TOOL),
)
export class EmailTemplateResolver {
  constructor(private readonly emailTemplateService: EmailTemplateService) {}

  @Query(() => [EmailTemplateDTO])
  async emailTemplates(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<EmailTemplateDTO[]> {
    return this.emailTemplateService.findAll(workspace.id);
  }

  @Mutation(() => EmailTemplateDTO)
  async saveEmailTemplate(
    @Args('input') input: SaveEmailTemplateInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<EmailTemplateDTO> {
    return this.emailTemplateService.save(workspace.id, input);
  }

  @Mutation(() => Boolean)
  async deleteEmailTemplate(
    @Args('id', ParseUUIDPipe) id: string,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<boolean> {
    return this.emailTemplateService.delete(workspace.id, id);
  }
}
