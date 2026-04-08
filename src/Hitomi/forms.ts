import {
  ButtonRow,
  Form,
  FormSectionElement,
  InputRow,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
  ToggleRow,
} from "@paperback/types";
import {
  ALL_DISCOVER_SECTIONS,
  DATE_SEPARATOR_OPTIONS,
  DEFAULT_SECTION_ORDER,
  DiscoverSectionDef,
  DisplayOptionId,
  getDateFormatOptionsWithSeparator,
  getDateFormatSetting,
  getDateSeparatorSetting,
  getDiscoverSectionOrder,
  getDisplayOptionsSetting,
  getEnableRelatedSetting,
  getExcludeTagsSetting,
  getFuzzySearchTagsSetting,
  getHiddenSections,
  getHideReadInRelatedSetting,
  getHideReadSetting,
  getIncludeTagsSetting,
  getIncognitoModeSetting,
  getLanguageSetting,
  getMarkReadOnViewSetting,
  getOnlyFuzzyUnknownTagsSetting,
  getPagesExpressionSetting,
  getPreferredImageFormatSetting,
  getRemoveSeparatorSpacesSetting,
  getScreenTimeEnabledSetting,
  getThumbnailQualitySetting,
  LANGUAGE_OPTIONS,
  PREFERRED_IMAGE_FORMAT_OPTIONS,
  PreferredImageFormat,
  resetHitomiSettings,
  sanitizePagesExpressionInput,
  setDateFormatSetting,
  setDateSeparatorSetting,
  setDiscoverSectionOrder,
  setDisplayOptionsSetting,
  setEnableRelatedSetting,
  setExcludeTagsSetting,
  setFuzzySearchTagsSetting,
  setHiddenSections,
  setHideReadInRelatedSetting,
  setHideReadSetting,
  setIncludeTagsSetting,
  setIncognitoModeSetting,
  setLanguageSetting,
  setMarkReadOnViewSetting,
  setOnlyFuzzyUnknownTagsSetting,
  setPagesExpressionSetting,
  setPreferredImageFormatSetting,
  setRemoveSeparatorSpacesSetting,
  setThumbnailQualitySetting,
} from "./settings";
import { StatisticsForm } from "./statistics";

// Helper function to format date examples based on current date format
function getDateExampleFor(dateFormatId: string, separator: string): string {
  const now = new Date();
  const d = now.getDate();
  const m = now.getMonth() + 1;
  const yy = now.getFullYear().toString().slice(-2);
  const yyyy = now.getFullYear().toString();
  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");

  const examples: Record<string, string> = {
    mm_dd_yy: `${mm}${separator}${dd}${separator}${yy}`,
    dd_mm_yyyy: `${dd}${separator}${mm}${separator}${yyyy}`,
    yyyy_mm_dd: `${yyyy}${separator}${mm}${separator}${dd}`,
    m_d_yy: `${m}${separator}${d}${separator}${yy}`,
    mm_yy: `${mm}${separator}${yy}`,
    yy_mm: `${yy}${separator}${mm}`,
    m_yy: `${m}${separator}${yy}`,
    yy_m: `${yy}${separator}${m}`,
  };
  return examples[dateFormatId] || "";
}

// Get dynamic separator options using current date format
function getDateSeparatorOptionsWithFormat(
  dateFormatId: string,
): { id: string; label: string; char: string }[] {
  return DATE_SEPARATOR_OPTIONS.map((opt) => ({
    id: opt.id,
    label: `${getDateExampleFor(dateFormatId, opt.char)} - ${opt.id.charAt(0).toUpperCase() + opt.id.slice(1)}`,
    char: opt.char,
  }));
}

// Display option labels with examples
function getDisplayOptionLabel(
  id: DisplayOptionId,
  dateFormat: string,
  dateSeparator: string,
  removeSpaces: boolean,
): string {
  const sep =
    DATE_SEPARATOR_OPTIONS.find((s) => s.id === dateSeparator)?.char ?? ".";
  const dateExample = getDateExampleFor(dateFormat, sep);
  const relativeExample = "9d"; // Example: 9 days ago

  // Format separators based on removeSpaces setting - trailing pipe only
  const langEx = removeSpaces ? '("EN |")' : '("EN |")';
  const pageEx = removeSpaces ? '("67p |")' : '("67p |")';
  const dateEx = removeSpaces ? `("${dateExample} |")` : `("${dateExample} |")`;
  const relEx = removeSpaces
    ? `("${relativeExample} |")`
    : `("${relativeExample} |")`;

  const labels: Record<DisplayOptionId, string> = {
    hide_read: "Hide Read Manga",
    hide_read_letter: "Show Read Indicator 'r'",
    show_lang_tip: `Show Language in Subtitle ${langEx}`,
    show_page_count: `Show Page Count ${pageEx}`,
    subtitle_date: `Show Date in Subtitle ${dateEx}`,
    subtitle_relative: `Show Relative Date in Subtitle ${relEx}`,
    desc_show_date: `Show Date in Description ${dateEx}`,
    desc_relative_date: `Show Relative Date in Description ${relEx}`,
    parodies_bottom: "Show Characters in Description",
    show_tags_in_desc: "Show Tags in Description",
    show_related_order: "Show Related Count and Order",
    show_manga_id_in_description: "Show Manga ID in Description",
    show_tag_counts: "Show Tag Counts in Search Filters",
    abbreviate_tag_counts: 'Show Tag Count Abbreviations ("11k")',
    show_reread_count: "Show Reread Count",
  };
  return labels[id] || id;
}

export class HitomiSettingsForm extends Form {
  private languageSetting = getLanguageSetting();
  private dateFormat = getDateFormatSetting();
  private dateSeparator = getDateSeparatorSetting();
  private displayOptions = getDisplayOptionsSetting();
  private thumbnailQuality = getThumbnailQualitySetting();
  private removeSpaces = getRemoveSeparatorSpacesSetting();
  private preferredImageFormat = getPreferredImageFormatSetting();
  private _mangaFiltersForm?: MangaFiltersForm;
  private _discoverOrderForm?: DiscoverOrderForm;
  private _statisticsForm?: StatisticsForm;

  private getMangaFiltersForm(): MangaFiltersForm {
    if (!this._mangaFiltersForm)
      this._mangaFiltersForm = new MangaFiltersForm();
    return this._mangaFiltersForm;
  }

  private getDiscoverOrderForm(): DiscoverOrderForm {
    if (!this._discoverOrderForm)
      this._discoverOrderForm = new DiscoverOrderForm();
    return this._discoverOrderForm;
  }

  private getStatisticsForm(): StatisticsForm {
    if (!this._statisticsForm) this._statisticsForm = new StatisticsForm();
    return this._statisticsForm;
  }

  override getSections(): FormSectionElement[] {
    // Build display options with dynamic date examples
    const displayOptionValues = [
      "hide_read_letter",
      "show_lang_tip",
      "show_page_count",
      "subtitle_date",
      "subtitle_relative",
      "desc_show_date",
      "desc_relative_date",
      "parodies_bottom",
      "show_tags_in_desc",
      "show_related_order",
      "show_tag_counts",
      "abbreviate_tag_counts",
      "show_manga_id_in_description",
    ] as DisplayOptionId[];

    // Build subtitle example based on current display options
    const sep = this.removeSpaces ? "|" : " | ";
    const parts: string[] = [];
    if (this.displayOptions.includes("show_lang_tip")) parts.push("EN");
    if (this.displayOptions.includes("show_page_count")) parts.push("67p");
    if (this.displayOptions.includes("subtitle_relative")) parts.push("5h");
    if (this.displayOptions.includes("subtitle_date")) {
      const dateSep =
        DATE_SEPARATOR_OPTIONS.find((s) => s.id === this.dateSeparator)?.char ??
        ".";
      parts.push(getDateExampleFor(this.dateFormat, dateSep));
    }
    const subtitleExample =
      parts.length > 0
        ? parts.join(sep)
        : this.removeSpaces
          ? "EN|67p"
          : "EN | 67p";

    return [
      // Main settings section
      Section("hitomiMain", [
        LabelRow("topLabel", {
          title: "Hitomi Settings",
          subtitle: `Subtitle Preview: ${subtitleExample}`,
        }),
        SelectRow("language", {
          title:
            this.languageSetting.length === 1 &&
            this.languageSetting[0] !== "all"
              ? "Preferred Language"
              : "Preferred Languages",
          subtitle: "Applied To Home And Search Results",
          value: this.languageSetting,
          options: LANGUAGE_OPTIONS.map((option) => ({
            id: option.id,
            title: option.label,
          })),
          minItemCount: 1,
          maxItemCount: LANGUAGE_OPTIONS.length,
          onValueChange: Application.Selector(
            this as HitomiSettingsForm,
            "updateLanguage",
          ),
        }),
      ]),
      // Thumbnail and Display Options section
      Section("displaySettingsNav", [
        // Display Options first
        SelectRow("displayOptions", {
          title: "Display Options",
          subtitle: "Customize Subtitles and Descriptions",
          value: this.displayOptions,
          options: displayOptionValues.map((id) => ({
            id,
            title: getDisplayOptionLabel(
              id,
              this.dateFormat,
              this.dateSeparator,
              this.removeSpaces,
            ),
          })),
          minItemCount: 0,
          maxItemCount: displayOptionValues.length,
          onValueChange: Application.Selector(
            this as HitomiSettingsForm,
            "updateDisplayOptions",
          ),
        }),
        ToggleRow("highQualityThumbnails", {
          title: "High Quality Thumbnails",
          value: this.thumbnailQuality === "high",
          onValueChange: Application.Selector(
            this as HitomiSettingsForm,
            "updateHighQualityThumbnails",
          ),
        }),
        ToggleRow("removeSpaces", {
          title: "Remove Spaces From Separators",
          value: this.removeSpaces,
          onValueChange: Application.Selector(
            this as HitomiSettingsForm,
            "updateRemoveSpaces",
          ),
        }),
      ]),
      // Statistics section
      Section("statistics", [
        NavigationRow("mangaFiltersNav", {
          title: "Manga Filters",
          subtitle: "Applied To Home And Search Results",
          form: this.getMangaFiltersForm(),
        }),
        NavigationRow("discoverOrderNav", {
          title: "Home & Search Sections",
          subtitle: "Toggle & Reorder Sections",
          form: this.getDiscoverOrderForm(),
        }),
        NavigationRow("statisticsNav", {
          title: getScreenTimeEnabledSetting()
            ? "Statistics & Screen Time"
            : "Statistics",
          form: this.getStatisticsForm(),
        }),
      ]),
      // Date and Format Settings section
      Section(
        {
          id: "dateSettings",
          footer:
            'Known Hitomi and App Limitations:\n\nCrashes occur due to memory issues. Hitomi does not serve lower resolution pages. Enabling "Downsample Pages" in the reader may help. Crashes occur more commonly on high page count manga; filter them out.\n\nHigh speed scrolling/high page counts commonly causes pages to error out because of Hitomi rate limits. Selecting retry once or a couple times usually works.',
        },
        [
          SelectRow("dateFormat", {
            title: "Date Format",
            value: [this.dateFormat],
            options: getDateFormatOptionsWithSeparator(this.dateSeparator).map(
              (opt) => ({
                id: opt.id,
                title: opt.label,
              }),
            ),
            minItemCount: 1,
            maxItemCount: 1,
            onValueChange: Application.Selector(
              this as HitomiSettingsForm,
              "updateDateFormat",
            ),
          }),
          SelectRow("dateSeparator", {
            title: "Date Separator",
            value: [this.dateSeparator],
            options: getDateSeparatorOptionsWithFormat(this.dateFormat).map(
              (opt) => ({
                id: opt.id,
                title: opt.label,
              }),
            ),
            minItemCount: 1,
            maxItemCount: 1,
            onValueChange: Application.Selector(
              this as HitomiSettingsForm,
              "updateDateSeparator",
            ),
          }),
        ],
      ),
      // Reset section
      Section("reset", [
        ButtonRow("resetSettings", {
          title: "Reset Settings",
          onSelect: Application.Selector(
            this as HitomiSettingsForm,
            "handleReset",
          ),
        }),
      ]),
    ];
  }

  async updateLanguage(value: string[]) {
    const selected =
      Array.isArray(value) && value.length > 0 ? value : this.languageSetting;
    this.languageSetting = selected as typeof this.languageSetting;
    setLanguageSetting(this.languageSetting);
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateHighQualityThumbnails(value: boolean) {
    this.thumbnailQuality = value ? "high" : "low";
    setThumbnailQualitySetting(this.thumbnailQuality);
  }

  async updateRemoveSpaces(value: boolean) {
    this.removeSpaces = !!value;
    setRemoveSeparatorSpacesSetting(this.removeSpaces);
    this.reloadForm();
  }

  async updatePreferredImageFormat(value: string[]) {
    const selected =
      (value?.[0] as PreferredImageFormat) ?? this.preferredImageFormat;
    this.preferredImageFormat = selected;
    setPreferredImageFormatSetting(selected);
  }

  async updateDateFormat(value: string[]) {
    const rawSelected = value?.[0];
    const selected = rawSelected !== undefined ? rawSelected : this.dateFormat;
    this.dateFormat = selected;
    setDateFormatSetting(selected);
    this.reloadForm();
  }

  async updateDateSeparator(value: string[]) {
    const selected =
      (value?.[0] as typeof this.dateSeparator) ?? this.dateSeparator;
    this.dateSeparator = selected;
    setDateSeparatorSetting(selected);
    this.reloadForm();
  }

  async updateDisplayOptions(value: string[]) {
    this.displayOptions = value as typeof this.displayOptions;
    setDisplayOptionsSetting(this.displayOptions);
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async handleReset() {
    resetHitomiSettings();
    this.languageSetting = getLanguageSetting();
    this.dateFormat = getDateFormatSetting();
    this.dateSeparator = getDateSeparatorSetting();
    this.displayOptions = getDisplayOptionsSetting();
    this.thumbnailQuality = getThumbnailQualitySetting();
    this.removeSpaces = getRemoveSeparatorSpacesSetting();
    this.preferredImageFormat = getPreferredImageFormatSetting();
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }
}

// -- Discover Order Form --

class DiscoverOrderForm extends Form {
  private order = getDiscoverSectionOrder();
  private hidden = getHiddenSections();

  constructor() {
    super();
    // Create per-section handlers dynamically so Application.Selector can
    // route each toggle/button to the correct section.
    for (const def of ALL_DISCOVER_SECTIONS) {
      (this as any)[`moveUp_${def.id}`] = async () => {
        this.moveSection(def.id, -1);
      };
      (this as any)[`moveDown_${def.id}`] = async () => {
        this.moveSection(def.id, 1);
      };
      (this as any)[`toggle_${def.id}`] = async (value: boolean) => {
        if (value) {
          this.hidden.delete(def.id);
        } else {
          this.hidden.add(def.id);
        }
        setHiddenSections(this.hidden);
        this.reloadForm();
      };
    }
  }

  private moveSection(sectionId: string, direction: number) {
    const idx = this.order.indexOf(sectionId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.order.length) return;
    [this.order[idx], this.order[newIdx]] = [
      this.order[newIdx],
      this.order[idx],
    ];
    setDiscoverSectionOrder(this.order);
    this.reloadForm();
  }

  override getSections(): FormSectionElement[] {
    const sectionMap = new Map<string, DiscoverSectionDef>(
      ALL_DISCOVER_SECTIONS.map((s) => [s.id, s]),
    );

    // Visibility toggles - prefix with "Show", only show subtitles for specific sections
    const toggleRows = this.order
      .map((id) => {
        const def = sectionMap.get(id);
        if (!def) return null;
        return ToggleRow(`vis_${id}`, {
          title: `Show ${def.title}`,
          subtitle: def.subtitle,
          value: !this.hidden.has(id),
          onValueChange: Application.Selector(
            this as DiscoverOrderForm,
            `toggle_${id}` as any,
          ),
        });
      })
      .filter((r): r is NonNullable<typeof r> => r != null);

    // Order rows with move buttons
    const orderRows: any[] = [];
    for (let i = 0; i < this.order.length; i++) {
      const id = this.order[i];
      const def = sectionMap.get(id);
      if (!def) continue;
      const hiddenMark = this.hidden.has(id) ? " (hidden)" : "";
      orderRows.push(
        LabelRow(`order_${id}`, {
          title: `${i + 1}. ${def.title}${hiddenMark}`,
        }),
      );
      if (i > 0) {
        orderRows.push(
          ButtonRow(`up_${id}`, {
            title: "↑ Move Up",
            onSelect: Application.Selector(
              this as DiscoverOrderForm,
              `moveUp_${id}` as any,
            ),
          }),
        );
      }
      if (i < this.order.length - 1) {
        orderRows.push(
          ButtonRow(`down_${id}`, {
            title: "↓ Move Down",
            onSelect: Application.Selector(
              this as DiscoverOrderForm,
              `moveDown_${id}` as any,
            ),
          }),
        );
      }
    }

    // Build current visible order as arrow-separated footer
    const visibleOrderFooter =
      this.order
        .filter((id) => !this.hidden.has(id))
        .map((id) => sectionMap.get(id)?.title)
        .filter(Boolean)
        .join(" -> ") || "No visible sections";

    return [
      Section({ id: "visibility", footer: visibleOrderFooter }, [
        ...toggleRows,
      ]),
      Section("ordering", [...orderRows]),
      Section("resetOrder", [
        ButtonRow("resetOrderBtn", {
          title: "Reset to Default Order",
          onSelect: Application.Selector(
            this as DiscoverOrderForm,
            "handleReset",
          ),
        }),
      ]),
    ];
  }

  async handleReset() {
    this.order = [...DEFAULT_SECTION_ORDER];
    this.hidden = new Set();
    setDiscoverSectionOrder(this.order);
    setHiddenSections(this.hidden);
    this.reloadForm();
  }
}

function stripTagPrefix(value: string): string {
  return value
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      // Check if this is an OR group (contains || or OR)
      if (/\s*\|\|\s*|\s+OR\s+/i.test(t)) {
        // Split by OR but preserve the OR syntax
        const orParts = t
          .split(/\s*\|\|\s*|\s+OR\s+/i)
          .map((part) => {
            let clean = part.trim();
            if (clean.startsWith("-")) clean = clean.slice(1);
            const prefixMatch = clean.match(
              /^(?:tag|female|male|artist|group|series|character|language):(.+)$/i,
            );
            if (prefixMatch) {
              clean = prefixMatch[1];
            }
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.slice(1, -1);
            }
            return clean;
          })
          .filter(Boolean);
        return orParts.join(" OR ");
      } else {
        let clean = t.startsWith("-") ? t.slice(1) : t;
        const prefixMatch = clean.match(
          /^(?:tag|female|male|artist|group|series|character|language):(.+)$/i,
        );
        if (prefixMatch) {
          clean = prefixMatch[1];
        }
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.slice(1, -1);
        }
        return clean;
      }
    })
    .join(", ");
}

class MangaFiltersForm extends Form {
  private includeTags = getIncludeTagsSetting();
  private excludeTags = getExcludeTagsSetting();
  private pagesExpr = getPagesExpressionSetting();
  private incognito = getIncognitoModeSetting();
  private hideRead = getHideReadSetting();
  private enableRelated = getEnableRelatedSetting();
  private hideReadInRelated = getHideReadInRelatedSetting();
  private markReadOnView = getMarkReadOnViewSetting();
  private preferredImageFormat = getPreferredImageFormatSetting();
  private fuzzySearchTags = getFuzzySearchTagsSetting();
  private onlyFuzzyUnknown = getOnlyFuzzyUnknownTagsSetting();

  override getSections(): FormSectionElement[] {
    const markReadOnViewEnabled = this.hideRead && !this.incognito;

    return [
      // Section 1: Tags, filters, and fuzzy toggle
      Section("filtersSection", [
        ToggleRow("fuzzySearchTags", {
          title: "Always Force Fuzzy Search",
          subtitle: this.fuzzySearchTags
            ? "Use 'uf!' for exact tag searches (e.g., 'uf!sole female, ana')."
            : "Use 'f!' for fuzzy searches (e.g., 'f!ana' matches 'anal birth', 'mana', 'anal').",
          value: this.fuzzySearchTags,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateFuzzySearchTags",
          ),
        }),
        ...(!this.fuzzySearchTags
          ? [
              ToggleRow("onlyFuzzyUnknown", {
                title: "Fuzzy Search Unknown Tags",
                subtitle: "Always Fuzzy Nonexistent Tags",
                value: this.onlyFuzzyUnknown,
                onValueChange: Application.Selector(
                  this as MangaFiltersForm,
                  "updateOnlyFuzzyUnknown",
                ),
              }),
            ]
          : []),
        InputRow("includeTags", {
          title: this.fuzzySearchTags
            ? "Included Tags (e.g. elf OR uf!oil)"
            : "Included Tags (e.g. elf, nun OR orc)",
          value: stripTagPrefix(this.includeTags),
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateIncludeTags",
          ),
        }),
        InputRow("excludeTags", {
          title: this.fuzzySearchTags
            ? "Excluded Tags (e.g. scat, uf!anal)"
            : "Excluded Tags (e.g. scat, f!oil)",
          value: stripTagPrefix(this.excludeTags),
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateExcludeTags",
          ),
        }),
        InputRow("pagesFilter", {
          title: "Page Count (e.g. 20-50, >21, <67, 69<)",
          value: this.pagesExpr,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updatePagesExpr",
          ),
        }),
      ]),
      // Section 2: Behavior toggles — single section, reordered
      Section("behaviorSection", [
        SelectRow("preferredImageFormat", {
          title: "Image Format",
          value: [this.preferredImageFormat],
          options: PREFERRED_IMAGE_FORMAT_OPTIONS.map((opt) => ({
            id: opt.id,
            title: opt.label,
          })),
          minItemCount: 1,
          maxItemCount: 1,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updatePreferredImageFormat",
          ),
        }),
        ToggleRow("pauseHideRead", {
          title: "Pause Manga Tracking",
          subtitle: "App Continues Tracking",
          value: this.incognito,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateIncognito",
          ),
        }),
        ToggleRow("hideReadInRelated", {
          title: "Hide Read Manga in Related",
          value: this.hideReadInRelated,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateHideReadInRelated",
          ),
        }),
        ToggleRow("hideRead", {
          title: "Hide Read Manga",
          subtitle: "Applies To Search And Discover",
          value: this.hideRead,
          onValueChange: Application.Selector(
            this as MangaFiltersForm,
            "updateHideRead",
          ),
        }),
        ...(markReadOnViewEnabled
          ? [
              ToggleRow("markReadOnView", {
                title: "Mark As Read On Description",
                value: this.markReadOnView,
                onValueChange: Application.Selector(
                  this as MangaFiltersForm,
                  "updateMarkReadOnView",
                ),
              }),
            ]
          : []),
      ]),
    ];
  }

  async updateIncludeTags(value: string) {
    // Store the raw value - backend will handle tag validation
    setIncludeTagsSetting(value ?? "");
    this.includeTags = getIncludeTagsSetting();
    this.reloadForm();
    try {
      (globalThis as any).__hitomiClearSearchCaches?.();
    } catch {
      /* ignore */
    }
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateExcludeTags(value: string) {
    // Store the raw value - backend will handle tag validation
    setExcludeTagsSetting(value ?? "");
    this.excludeTags = getExcludeTagsSetting();
    this.reloadForm();
    try {
      (globalThis as any).__hitomiClearSearchCaches?.();
    } catch {
      /* ignore */
    }
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updatePagesExpr(value: string) {
    this.pagesExpr = sanitizePagesExpressionInput(value ?? "");
    setPagesExpressionSetting(this.pagesExpr);
    this.pagesExpr = getPagesExpressionSetting();
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateIncognito(value: boolean) {
    this.incognito = !!value;
    setIncognitoModeSetting(this.incognito);
    if (this.incognito && this.markReadOnView) {
      this.markReadOnView = false;
      setMarkReadOnViewSetting(false);
    }
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateHideRead(value: boolean) {
    this.hideRead = !!value;
    setHideReadSetting(this.hideRead);
    if (!this.hideRead && this.markReadOnView) {
      this.markReadOnView = false;
      setMarkReadOnViewSetting(false);
    }
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateEnableRelated(value: boolean) {
    this.enableRelated = !!value;
    setEnableRelatedSetting(this.enableRelated);
    if (!this.enableRelated && this.hideReadInRelated) {
      this.hideReadInRelated = false;
      setHideReadInRelatedSetting(false);
    }
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateHideReadInRelated(value: boolean) {
    this.hideReadInRelated = !!value;
    setHideReadInRelatedSetting(this.hideReadInRelated);
  }

  async updateMarkReadOnView(value: boolean) {
    this.markReadOnView = !!value;
    setMarkReadOnViewSetting(this.markReadOnView);
  }

  async updatePreferredImageFormat(value: string[]) {
    const selected =
      (value?.[0] as PreferredImageFormat) ?? this.preferredImageFormat;
    this.preferredImageFormat = selected;
    setPreferredImageFormatSetting(selected);
  }

  async updateFuzzySearchTags(value: boolean) {
    this.fuzzySearchTags = !!value;
    setFuzzySearchTagsSetting(this.fuzzySearchTags);
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }

  async updateOnlyFuzzyUnknown(value: boolean) {
    this.onlyFuzzyUnknown = !!value;
    setOnlyFuzzyUnknownTagsSetting(this.onlyFuzzyUnknown);
    this.reloadForm();
    try {
      Application.invalidateSearchFilters();
    } catch {
      /* ignore */
    }
  }
}
