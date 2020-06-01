/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react')

const CompLibrary = require('../../core/CompLibrary.js')

const MarkdownBlock = CompLibrary.MarkdownBlock /* Used to read markdown */
const Container = CompLibrary.Container
const GridBlock = CompLibrary.GridBlock

class HomeSplash extends React.Component {
  render() {
    const { siteConfig, language = '' } = this.props
    const { baseUrl, docsUrl } = siteConfig
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`
    const langPart = `${language ? `${language}/` : ''}`
    const docUrl = doc => `${baseUrl}${docsPart}${langPart}${doc}`

    const SplashContainer = props => (
      <div className="homeContainer">
        <div className="homeSplashFade">
          <div className="wrapper homeWrapper">{props.children}</div>
        </div>
      </div>
    )

    const Logo = props => (
      <div className="projectLogo">
        <img src={props.img_src} alt="Project Logo" />
      </div>
    )

    const ProjectTitle = props => (
      <h2 className="projectTitle">
        {props.title}
        <small>{props.tagline}</small>
      </h2>
    )

    const PromoSection = props => (
      <div className="section promoSection">
        <div className="promoRow">
          <div className="pluginRowBlock">{props.children}</div>
        </div>
      </div>
    )

    const Button = props => (
      <div className="pluginWrapper buttonWrapper">
        <a
          className="button"
          href={props.href}
          target={props.target}
          rel={props.rel}
        >
          {props.children}
        </a>
      </div>
    )

    return (
      <SplashContainer>
        <Logo img_src={`${baseUrl}img/undraw_relaxing_at_home.svg`} />
        <div className="inner">
          <ProjectTitle tagline={siteConfig.tagline} title={siteConfig.title} />
          <PromoSection>
            <Button href={docUrl('introduction/quick_start')}>
              Get Started
            </Button>
            <Button
              href="https://pouchdb.com/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Get PouchDB
            </Button>
          </PromoSection>
        </div>
      </SplashContainer>
    )
  }
}

class Index extends React.Component {
  render() {
    const { config: siteConfig, language = '' } = this.props
    const { baseUrl } = siteConfig

    const Block = props => (
      <Container
        padding={['bottom', 'top']}
        id={props.id}
        background={props.background}
      >
        <GridBlock
          align="center"
          contents={props.children}
          layout={props.layout}
        />
      </Container>
    )

    const OfflineFirst = () => (
      <Block background="light">
        {[
          {
            content:
              'By using PouchDB your app can become [offline first](http://offlinefirst.org/).' +
              '<br />PouchDB can store data on your users browser. ' +
              'And sync it once they come back online.',
            image: `${baseUrl}img/undraw_going_offline.svg`,
            imageAlign: 'right',
            title: 'Offline first',
          },
        ]}
      </Block>
    )

    const Features = () => (
      <Block layout="fourColumn">
        {[
          {
            content:
              'usePouchDB is a collection of hooks, which allow you to access [PouchDB]() ' +
              'directly from your components. All the extendability of hooks comes along with it.',
            image: `${baseUrl}img/undraw_react.svg`,
            imageAlign: 'top',
            title: 'React Hooks',
          },
          {
            content:
              'usePouchDBs hooks are inspired by PouchDB methods, ' +
              'and use similar options and return their results. ' +
              'Allowing you to bring all your knowledge along.',
            image: `${baseUrl}img/undraw_certification.svg`,
            imageAlign: 'top',
            title: 'Familiar',
          },
          {
            content:
              'Your components become a function of your database. ' +
              'All hooks subscribe to changes in your database and update when they happen.',
            image: `${baseUrl}img/undraw_file_analysis.svg`,
            imageAlign: 'top',
            title: 'Predictable',
          },
        ]}
      </Block>
    )

    const Showcase = () => {
      if ((siteConfig.users || []).length === 0) {
        return null
      }

      const showcase = siteConfig.users
        .filter(user => user.pinned)
        .map(user => (
          <a href={user.infoLink} key={user.infoLink}>
            <img src={user.image} alt={user.caption} title={user.caption} />
          </a>
        ))

      const pageUrl = page => baseUrl + (language ? `${language}/` : '') + page

      return (
        <div className="productShowcaseSection paddingBottom">
          <h2>Who is Using This?</h2>
          <p>This project is used by all these people</p>
          <div className="logos">{showcase}</div>
          <div className="more-users">
            <a className="button" href={pageUrl('users.html')}>
              More {siteConfig.title} Users
            </a>
          </div>
        </div>
      )
    }

    return (
      <div>
        <HomeSplash siteConfig={siteConfig} language={language} />
        <div className="mainContainer">
          <Features />
          <OfflineFirst />
          <Showcase />
        </div>
      </div>
    )
  }
}

module.exports = Index
