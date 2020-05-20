/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react')

const CompLibrary = require('../../core/CompLibrary.js')

const Container = CompLibrary.Container
const GridBlock = CompLibrary.GridBlock

function Help(props) {
  const { config: siteConfig, language = '' } = props
  const { baseUrl, docsUrl, repoUrl } = siteConfig
  const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`
  const langPart = `${language ? `${language}/` : ''}`
  const docUrl = doc => `${baseUrl}${docsPart}${langPart}${doc}`

  const supportLinks = [
    {
      content: `Learn more using the [documentation on this site.](${docUrl(
        'introduction/quick_start'
      )})`,
      title: 'Browse Docs',
    },
    {
      content: `If your are stuck or have questions, ask them [on twitter](https://twitter.com/terreii) on on [GitHub](${repoUrl}).`,
      title: 'Ask questions',
    },
    {
      content: 'Images are provided by [undraw.co](https://undraw.co/).',
      title: 'Image Source',
    },
  ]

  return (
    <div className="docMainWrapper wrapper">
      <Container className="mainContainer documentContainer postContainer">
        <div className="post">
          <header className="postHeader">
            <h1>Need help?</h1>
          </header>
          <p>
            This project is maintained by me,
            <a href="https://christopher-astfalk.de/"> Christopher Astfalk</a>.
          </p>
          <GridBlock contents={supportLinks} layout="threeColumn" />
        </div>
      </Container>
    </div>
  )
}

module.exports = Help
