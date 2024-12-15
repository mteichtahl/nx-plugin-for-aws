/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg?: React.ComponentType<React.ComponentProps<'svg'>>;
  description: JSX.Element;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'No More Projen',
    //Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        While projects-as-code has its place, many customers and engineers found
        the layer of abstraction too cumbersome.
      </>
    ),
  },
  {
    title: 'All the Power of Nx',
    //Svg: require('@site/static/img/nx-logo.svg').default,
    description: (
      <>
        Using Nx directly rather than via projen gives you full control over
        tasks and caching, allowing for faster dev cycles.
      </>
    ),
  },
  {
    title: 'Full Control',
    //Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Generators get you started quickly, but you can fully customise your
        projects without relying on features being available in PDK/Projen. You
        have control of all project files, like <code>package.json</code> or{' '}
        <code>tsconfig.json</code>
      </>
    ),
  },
];

function Feature({ title, Svg, description }: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        {Svg ? (
          <Svg className={styles.featureSvg} role="img" />
        ) : (
          <div style={{ height: 210 }}></div>
        )}
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
