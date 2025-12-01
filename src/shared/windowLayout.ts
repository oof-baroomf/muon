export interface NavButtonConfig {
  back: string;
  forward: string;
  reload: string;
  stop: string;
}

export interface NavTitleConfig {
  back: string;
  forward: string;
  reload: string;
  stop: string;
}

export interface WindowLayoutConfig {
  barHeight: number;
  viewPadding: number;
  nav: {
    buttonSize: number;
    fontSize: number;
    gap: number;
    marginLeft: number;
    icons: NavButtonConfig;
    titles: NavTitleConfig;
  };
  urlBar: {
    fontSize: number;
    heightInset: number;
    marginRight: number;
  };
  removeButton: {
    label: string;
    title: string;
    size: number;
    marginRight: number;
  };
  minWindow: {
    width: number;
    height: number;
  };
  resizeHandles: {
    corner: number;
    edge: number;
    inset: number;
  };
}

export const defaultWindowLayout: WindowLayoutConfig = {
  barHeight: 24,
  viewPadding: 8,
  nav: {
    buttonSize: 16,
    fontSize: 12,
    gap: 2,
    marginLeft: 4,
    icons: {
      back: '←',
      forward: '→',
      reload: '⟳',
      stop: '⨉'
    },
    titles: {
      back: 'Back',
      forward: 'Forward',
      reload: 'Reload',
      stop: 'Stop'
    }
  },
  urlBar: {
    fontSize: 12,
    heightInset: 4,
    marginRight: 2
  },
  removeButton: {
    label: '×',
    title: 'Remove window',
    size: 16,
    marginRight: 2
  },
  minWindow: {
    width: 280,
    height: 120
  },
  resizeHandles: {
    corner: 12,
    edge: 8,
    inset: 12
  }
};

function ensureNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeWindowLayout(layout: Partial<WindowLayoutConfig> | undefined): WindowLayoutConfig {
  const src = layout ?? {};
  const navIcons: Partial<NavButtonConfig> = src.nav?.icons ?? {};
  const navTitles: Partial<NavTitleConfig> = src.nav?.titles ?? {};
  const defaults = defaultWindowLayout;

  const barHeight = ensureNumber(src.barHeight, defaults.barHeight);

  const urlHeightInset = Math.min(
    Math.max(0, ensureNumber(src.urlBar?.heightInset, defaults.urlBar.heightInset)),
    Math.max(0, barHeight - 2)
  );

  return {
    barHeight,
    viewPadding: ensureNumber(src.viewPadding, defaults.viewPadding),
    nav: {
      buttonSize: ensureNumber(src.nav?.buttonSize, defaults.nav.buttonSize),
      fontSize: ensureNumber(src.nav?.fontSize, defaults.nav.fontSize),
      gap: ensureNumber(src.nav?.gap, defaults.nav.gap),
      marginLeft: ensureNumber(src.nav?.marginLeft, defaults.nav.marginLeft),
      icons: {
        back: typeof navIcons.back === 'string' ? navIcons.back : defaults.nav.icons.back,
        forward: typeof navIcons.forward === 'string' ? navIcons.forward : defaults.nav.icons.forward,
        reload: typeof navIcons.reload === 'string' ? navIcons.reload : defaults.nav.icons.reload,
        stop: typeof navIcons.stop === 'string' ? navIcons.stop : defaults.nav.icons.stop
      },
      titles: {
        back: typeof navTitles.back === 'string' ? navTitles.back : defaults.nav.titles.back,
        forward: typeof navTitles.forward === 'string' ? navTitles.forward : defaults.nav.titles.forward,
        reload: typeof navTitles.reload === 'string' ? navTitles.reload : defaults.nav.titles.reload,
        stop: typeof navTitles.stop === 'string' ? navTitles.stop : defaults.nav.titles.stop
      }
    },
    urlBar: {
      fontSize: ensureNumber(src.urlBar?.fontSize, defaults.urlBar.fontSize),
      heightInset: urlHeightInset,
      marginRight: ensureNumber(src.urlBar?.marginRight, defaults.urlBar.marginRight)
    },
    removeButton: {
      label: typeof src.removeButton?.label === 'string' ? src.removeButton.label : defaults.removeButton.label,
      title: typeof src.removeButton?.title === 'string' ? src.removeButton.title : defaults.removeButton.title,
      size: ensureNumber(src.removeButton?.size, defaults.removeButton.size),
      marginRight: ensureNumber(src.removeButton?.marginRight, defaults.removeButton.marginRight)
    },
    minWindow: {
      width: ensureNumber(src.minWindow?.width, defaults.minWindow.width),
      height: ensureNumber(src.minWindow?.height, defaults.minWindow.height)
    },
    resizeHandles: {
      corner: ensureNumber(src.resizeHandles?.corner, defaults.resizeHandles.corner),
      edge: ensureNumber(src.resizeHandles?.edge, defaults.resizeHandles.edge),
      inset: ensureNumber(src.resizeHandles?.inset, defaults.resizeHandles.inset)
    }
  };
}
