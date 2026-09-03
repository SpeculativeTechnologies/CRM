import { lazy } from 'react';
import { matchPath, Navigate } from 'react-router-dom';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';

import { LazyRoute } from '@/app/components/LazyRoute';
import {
  createSettingsRouteObjects,
  SettingsRouteOutlet,
} from '@/app/components/SettingsRoutes';
import { type WorkspaceRouteObject } from '@/app/routing/types/WorkspaceRouteObject';
import indexAppPath from '@/navigation/utils/indexAppPath';
import { RecordIndexSkeletonLoader } from '@/object-record/record-index/components/RecordIndexSkeletonLoader';
import { lazyWithPreload } from '~/utils/lazyWithPreload';

const WorkflowCoreIndexPage = lazy(() =>
  import('~/pages/object-core/WorkflowCoreIndexPage').then((module) => ({
    default: module.WorkflowCoreIndexPage,
  })),
);

const RecordIndexPage = lazyWithPreload(() =>
  import('~/pages/object-record/RecordIndexPage').then((module) => ({
    default: module.RecordIndexPage,
  })),
);

const RecordShowPage = lazyWithPreload(() =>
  import('~/pages/object-record/RecordShowPage').then((module) => ({
    default: module.RecordShowPage,
  })),
);

// On a direct URL load the matched page's lazy chunk is only requested once
// auth and metadata gates have opened. Warming it at boot lets the chunk
// download in parallel with those round trips instead of after them.
export const preloadWorkspacePageChunkForPath = (pathname: string) => {
  if (matchPath(AppPath.RecordShowPage, pathname) !== null) {
    RecordShowPage.preload();

    return;
  }

  if (matchPath(AppPath.RecordIndexPage, pathname) !== null) {
    RecordIndexPage.preload();
  }
};

const StandalonePageLayoutPage = lazy(() =>
  import('~/pages/page-layout/StandalonePageLayoutPage').then((module) => ({
    default: module.StandalonePageLayoutPage,
  })),
);

const MassEmailPage = lazy(() =>
  import('~/pages/mass-email/MassEmailPage').then((module) => ({
    default: module.MassEmailPage,
  })),
);

const PersonDuplicatesPage = lazy(() =>
  import('~/pages/person-duplicate-review/PersonDuplicatesPage').then(
    (module) => ({
      default: module.PersonDuplicatesPage,
    }),
  ),
);

const EmailsPage = lazy(() =>
  import('~/pages/emails/EmailsPage').then((module) => ({
    default: module.EmailsPage,
  })),
);

const AiChatPage = lazy(() =>
  import('~/pages/ai-chat/AiChatPage').then((module) => ({
    default: module.AiChatPage,
  })),
);

const MobileHomePage = lazy(() =>
  import('~/pages/mobile-home/MobileHomePage').then((module) => ({
    default: module.MobileHomePage,
  })),
);

const NotFound = lazy(() =>
  import('~/pages/not-found/NotFound').then((module) => ({
    default: module.NotFound,
  })),
);

type CreateWorkspaceRouteObjectsArgs = {
  isAdminPageEnabled?: boolean;
  isWorkflowCoreIndexPageEnabled?: boolean;
};

const MAIN_AND_SIDE_PANEL = ['main', 'side-panel'] as const;
const SETTINGS_ROOT_PATH = AppPath.SettingsCatchAll.replace('/*', '');

export const createWorkspaceRouteObjects = ({
  isAdminPageEnabled,
  isWorkflowCoreIndexPageEnabled,
}: CreateWorkspaceRouteObjectsArgs): WorkspaceRouteObject[] => {
  const settingsRouteObjects = createSettingsRouteObjects({
    isAdminPageEnabled,
  });

  return [
    ...(isWorkflowCoreIndexPageEnabled
      ? [
          {
            path: AppPath.WorkflowCoreIndexPage,
            element: (
              <LazyRoute>
                <WorkflowCoreIndexPage />
              </LazyRoute>
            ),
            handle: {
              workspaceSurfaces: MAIN_AND_SIDE_PANEL,
              isLocationExpandableFromSidePanel: true,
            },
          } satisfies WorkspaceRouteObject,
        ]
      : []),
    {
      path: indexAppPath.getIndexAppPath(),
      element: <RecordIndexSkeletonLoader />,
    },
    {
      path: AppPath.RecordIndexPage,
      element: (
        <LazyRoute fallback={<RecordIndexSkeletonLoader />}>
          <RecordIndexPage />
        </LazyRoute>
      ),
      handle: {
        workspaceSurfaces: MAIN_AND_SIDE_PANEL,
        isLocationExpandableFromSidePanel: true,
      },
    },
    {
      path: AppPath.RecordShowPage,
      element: (
        <LazyRoute>
          <RecordShowPage />
        </LazyRoute>
      ),
      handle: { workspaceSurfaces: MAIN_AND_SIDE_PANEL },
    },
    {
      path: AppPath.PageLayoutPage,
      element: (
        <LazyRoute>
          <StandalonePageLayoutPage />
        </LazyRoute>
      ),
    },
    {
      path: AppPath.MassEmail,
      element: (
        <LazyRoute>
          <MassEmailPage />
        </LazyRoute>
      ),
    },
    {
      path: AppPath.Emails,
      element: (
        <LazyRoute>
          <EmailsPage />
        </LazyRoute>
      ),
    },
    {
      path: AppPath.EmailsNew,
      element: (
        <LazyRoute>
          <EmailsPage />
        </LazyRoute>
      ),
    },
    {
      path: AppPath.EmailsCampaign,
      element: (
        <LazyRoute>
          <EmailsPage />
        </LazyRoute>
      ),
    },
    {
      path: AppPath.Duplicates,
      element: (
        <LazyRoute>
          <PersonDuplicatesPage />
        </LazyRoute>
      ),
    },
    {
      path: AppPath.AiChat,
      element: (
        <LazyRoute>
          <AiChatPage />
        </LazyRoute>
      ),
    },
    {
      path: AppPath.Home,
      element: (
        <LazyRoute>
          <MobileHomePage />
        </LazyRoute>
      ),
    },
    {
      path: SETTINGS_ROOT_PATH,
      element: <SettingsRouteOutlet />,
      children: settingsRouteObjects,
    },
    {
      path: AppPath.Dpa,
      element: <Navigate to={getSettingsPath(SettingsPath.LegalDpa)} replace />,
    },
    {
      path: AppPath.NotFoundWildcard,
      element: (
        <LazyRoute>
          <NotFound />
        </LazyRoute>
      ),
    },
  ];
};
