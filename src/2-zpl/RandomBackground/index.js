"use strict";
/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, Library) => {
    const { Logger, Settings } = Library;
    return class extends Plugin {
        constructor() {
            super();
            this.image_urls = [];
            this.image_queue = [];
            this.defaultSettings = {
                alpha: 0.625,
                image_urls_pool: [],
                image_urls_string: '',
                last_image_url: '',
                interval: 0,
                interval_id: null,
                fading_seconds: 3,
                use_image_proxy: false,
                transition_type: { label: 'Instant switch', value: '' }
            };
        }
        /**
         * Retrieves a random image URL from the list of available image URLs.
         *
         * @param {boolean} prevent_cache - Determines whether to prevent caching of the image URL.
         * @return {string} The randomly selected image URL.
         */
        GetRandomImageURL(prevent_cache = false) {
            if (this.image_urls.length == 0)
                return '';
            if (this.settings.image_urls_pool.length == 0) {
                this.settings.image_urls_pool = structuredClone(this.image_urls);
            }
            let image_url = '';
            while (this.settings.image_urls_pool) {
                const random_index = Math.floor(Math.random() * this.settings.image_urls_pool.length);
                image_url = this.settings.image_urls_pool[random_index];
                this.settings.image_urls_pool.splice(random_index, 1);
                if (this.settings.image_urls_pool.length == 0) {
                    this.settings.image_urls_pool = structuredClone(this.image_urls);
                }
                if (this.image_urls.includes(image_url) &&
                    (this.image_urls.length <= 1 || image_url != this.settings.last_image_url))
                    break;
            }
            this.SaveSettings();
            if (prevent_cache) {
                let url = new URL(image_url);
                url.hash = Math.floor(Math.random() * Math.pow(2, 32)).toString();
                image_url = url.toString();
            }
            return image_url;
        }
        GetResizeImageURL(image_url) {
            return `https://image-proxy-discord-plus.fly.dev/?size=${window.innerWidth}x${window.innerHeight}&url=${encodeURIComponent(image_url)}`;
        }
        /**
         * Preloads the next image in a 1x1 <img>.
         */
        PreloadImage() {
            this.preload_img.src = this.image_queue[0];
        }
        /**
         * Updates the background image.
         *
         * @param {boolean} should_change_image - Whether or not to change the background image or just the opacity.
         */
        ApplyBackgroundImage(should_change_image = true) {
            let image_url;
            if (should_change_image) {
                // change image
                image_url = this.image_queue.shift();
                Logger.info(`Setting background image to ${image_url}`);
                this.settings.last_image_url = image_url;
                this.SaveSettings();
            }
            else {
                // change opacity
                image_url = this.settings.last_image_url;
                Logger.info(`Setting background opacity to ${this.settings.alpha}`);
            }
            const transition_rule = this.settings.transition_type === '' ? '' : `transition: background-image ${this.settings.fading_seconds}s ${this.settings.transition_type};`;
            this.global_css.textContent = `.theme-dark {
        --dplus-background-color-alpha: ${this.settings.alpha} !important;
      }

      div#app-mount {
        ${transition_rule}
        background-image: url(${image_url}) !important;
        background-blend-mode: darken;
      }`;
        }
        /**
         * Apply a random background image.
         */
        ApplyRandomBackgroundImage(apply_immediately = true) {
            if (this.image_urls.length <= 0)
                return;
            while (this.image_queue.length < 2) {
                const url = this.GetRandomImageURL();
                this.image_queue.push(this.settings.use_image_proxy ? this.GetResizeImageURL(url) : url);
            }
            if (apply_immediately)
                this.ApplyBackgroundImage();
            this.PreloadImage();
        }
        /**
         * Sets up an interval to apply a random background image at a specified interval.
         */
        SetupInterval() {
            this.ClearInterval();
            if (this.settings.interval <= 0)
                return;
            this.settings.interval_id = setInterval(() => {
                this.ApplyRandomBackgroundImage();
            }, this.settings.interval * 1000);
            this.SaveSettings();
        }
        /**
         * Clears the interval and saves the settings.
         */
        ClearInterval() {
            if (this.settings.interval_id)
                clearInterval(this.settings.interval_id);
            this.settings.interval_id = null;
            this.SaveSettings();
        }
        /**
         * Parses the image URLs from a given string.
         *
         * @param {string} image_str - The string containing the image URLs.
         * @return {Array} An array of parsed image URLs.
         */
        ParseImageURLs(image_str) {
            return image_str.split('\n').map(x => x.split('#')[0].trim()).filter(x => x && !x.startsWith('#') && !x.startsWith('//'));
        }
        /**
         * Initializes the component when it is started.
         */
        onStart() {
            this.ClearInterval();
            this.settings = Object.assign(Object.assign({}, this.default_settings), BdApi.Data.load(this.name, 'settings'));
            this.image_urls = this.ParseImageURLs(this.settings.image_urls_string) || [];
            this.settings.image_urls_pool = this.settings.image_urls_pool.map(x => x.trim()).filter(x => x);
            this.image_queue = [];
            const global_css_id = 'random_background_css';
            this.global_css = document.getElementById(global_css_id);
            if (!this.global_css) {
                this.global_css = document.getElementById(global_css_id) || Object.assign(document.createElement('style'), {
                    id: global_css_id
                });
                document.body.appendChild(this.global_css);
            }
            const preload_img_id = 'preload_image';
            this.preload_img = document.getElementById(preload_img_id);
            if (!this.preload_img) {
                this.preload_img = document.getElementById(preload_img_id) || Object.assign(document.createElement('img'), {
                    id: preload_img_id,
                    style: 'display: none;',
                    width: 1,
                    height: 1,
                    src: ''
                });
                document.body.appendChild(this.preload_img);
            }
            this.ApplyRandomBackgroundImage();
            this.SetupInterval();
        }
        /**
         * Removes the global CSS and preload image from the document body
         * and clears the interval.
         */
        onStop() {
            document.body.removeChild(this.global_css);
            document.body.removeChild(this.preload_img);
            this.ClearInterval();
        }
        /**
         * Builds an element with the specified type, attributes, and event handler.
         *
         * @param {type} element_type - The type of element to be created.
         * @param {type} attributes - The attributes to be assigned to the element.
         * @param {type} handler - The event handler function.
         * @return {type} - The newly created element.
         */
        BuildElementWithHandler(element_type, attributes, handler) {
            const element = Object.assign(document.createElement(element_type), attributes);
            element.addEventListener('change', event => {
                handler(event.target);
            });
            return element;
        }
        /**
         * Save the settings.
         */
        SaveSettings() {
            BdApi.Data.save(this.name, 'settings', this.settings);
        }
        /**
         * Generates the settings panel for the plugin.
         *
         * @return {SettingPanel} The settings panel for the plugin.
         */
        getSettingsPanel() {
            const interval_textbox = new Settings.Textbox('Interval of image changes', 'Time before switching to a new image (in seconds, <=0: do not switch images until a plugin/Discord restart)', this.settings.interval, new_data => {
                this.settings.interval = parseInt(new_data) || this.defaultSettings.interval;
                this.SetupInterval();
            }, {
                placeholder: this.defaultSettings.interval
            });
            const use_proxy_switch = new Settings.Switch('Enable image proxy server', 'Use a proxy server to resize and crop images to window size which prevents the resizing animation while fading in', this.settings.use_image_proxy, new_data => {
                this.settings.use_image_proxy = new_data;
                this.image_queue = [];
                this.ApplyRandomBackgroundImage(false);
            });
            const background_transition_type = new Settings.Dropdown('Background switch method', 'Methods of switching background images', this.settings.transition_type, [
                { value: '', label: 'Switch directly without animations' },
                { value: 'ease', label: 'Starts and ends with a moderate speed, with a smoother middle' },
                { value: 'ease-in-out', label: 'Gradual start, smooth middle, gradual end' },
                { value: 'ease-in', label: 'Slow start, picks up speed' },
                { value: 'ease-out', label: 'Consistent speed, slow finish' },
                { value: 'linear', label: 'Constant speed throughout' },
            ], new_data => {
                this.settings.transition_type = new_data;
            }, {
                clearable: false
            });
            const opacity_textbox = new Settings.Textbox('', '', this.settings.alpha, new_data => {
                this.settings.alpha = +parseFloat(new_data).toFixed(3) || this.defaultSettings.alpha;
                this.ApplyBackgroundImage(false);
            }, {
                placeholder: this.defaultSettings.alpha
            });
            const opacity_slider = new Settings.Slider('Opacity of background image', '', 0, 1.0, this.settings.alpha, new_data => {
                this.settings.alpha = +parseFloat(new_data).toFixed(3) || this.defaultSettings.alpha;
                this.ApplyBackgroundImage(false);
            }, {
                keyboardStep: 0.05,
                markers: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
            });
            const fade_time_textbox = new Settings.Textbox('Fading time of background image (in seconds)', '', this.settings.fading_seconds, new_data => {
                this.settings.fading_seconds = +parseFloat(new_data).toFixed(3) || this.defaultSettings.fading_seconds;
                this.ApplyBackgroundImage(false);
            }, {
                placeholder: this.defaultSettings.fading_seconds
            });
            let image_urls_textarea_rows = (this.settings.image_urls_string.match(/\n/g) || []).length + 1;
            if (image_urls_textarea_rows <= 1)
                image_urls_textarea_rows = 5;
            const image_urls_textarea = this.BuildElementWithHandler('textarea', {
                value: this.settings.image_urls_string,
                spellcheck: false,
                rows: image_urls_textarea_rows,
                cols: 80,
                placeholder: '# Flowers\nhttps://xxx/a.jpg\n\n// Cute cats!\nhttps://yyy/b.png'
            }, target => {
                this.settings.image_urls_string = target.value;
                this.image_urls = this.ParseImageURLs(target.value) || [];
                this.settings.image_urls_pool = structuredClone(this.image_urls);
                this.ApplyRandomBackgroundImage();
                this.SetupInterval();
            });
            image_urls_textarea.addEventListener('input', function (event) {
                this.style.height = '0';
                this.style.height = `${this.scrollHeight}px`;
            });
            return Settings.SettingPanel.build(this.saveSettings.bind(this), interval_textbox, use_proxy_switch, background_transition_type, opacity_slider, opacity_textbox, fade_time_textbox, image_urls_textarea);
        }
    };
};
